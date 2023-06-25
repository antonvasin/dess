import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { resolve } from "https://deno.land/std@0.192.0/path/mod.ts";
import { collect, copyPublic, LayoutProps, PageLink, writePage } from "./mod.tsx";

const HMR_SOCKETS: Set<WebSocket> = new Set();
const HMR_CLIENT = `let socket;
let reconnectTimer;

const wsOrigin = window.location.origin
  .replace("http", "ws")
  .replace("https", "wss");
const hmrUrl = wsOrigin + "/hmr";

hmrSocket();

function hmrSocket(callback) {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(hmrUrl);
  socket.addEventListener("open", callback);
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data)
    if (data.type === "refresh") {
      console.log("[HMR] Refreshing…");
      window.location.reload();
    }
  });

  socket.addEventListener("close", () => {
    console.log("[HMR] Reconnecting...");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      hmrSocket(() => {
        window.location.reload();
      });
    }, 1000);
  });
}
`;

function DevLayout(
  { html, title = "Dev Blog Title", routes = [], page, headings = [] }: LayoutProps,
) {
  return (
    <html>
      <head>
        <script src="/hmr.js" type="module" async />
      </head>
      <body>
        <header>
          {title && <h1>{title}</h1>}
          <nav>
            <ul>
              {routes.map((route) => (
                <li>
                  <PageLink page={route}>{route}</PageLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main innerHTML={{ __dangerousHtml: html }} />
        <hr />
        <footer>
          <dl>
            <dt>Page name</dt>
            <dd>
              <pre>{page}</pre>
            </dd>

            <dt>Current page headings</dt>
            <dd>
              <dl>
                {headings.map((heading) => (
                  <div>
                    <dt>{heading.text}</dt>
                    <dd>
                      <pre>{heading.slug}</pre>
                    </dd>
                  </div>
                ))}
              </dl>
            </dd>

            <dt>Page count</dt>
            <dd>{routes.length}</dd>
          </dl>
        </footer>
      </body>
    </html>
  );
}

async function watchForChanges(
  postsDirectory: string,
  updateFn: (path?: string) => Promise<unknown>,
) {
  await updateFn();
  const watcher = Deno.watchFs(postsDirectory);
  for await (const event of watcher) {
    performance.mark("start-refresh");
    if (event.kind === "modify" || event.kind === "create") {
      console.log("Event: ", event.kind);

      for (const path of event.paths) {
        console.log(("Event path: ", path));

        if (path.endsWith(".md")) {
          try {
            console.info(`File ${path} changed. Building…`);
            await updateFn(path);
            performance.mark("end-refresh");
            const refreshDur =
              performance.measure("refresh time", "start-refresh", "end-refresh").duration;
            console.info(`Refreshed in ${refreshDur.toFixed(2)}ms`);
            HMR_SOCKETS.forEach((socket) => {
              socket.send(JSON.stringify({ type: "refresh" }));
            });
          } catch (err) {
            console.error(`${path} error:`, err.message);
          }
        }
      }
    }
  }
}

const args = parse(Deno.args, {
  string: ["srcDir, outDir", "layout"],
  boolean: ["debug"],
  default: {
    srcDir: "./",
    outDir: "./dist",
  },
});

const srcDir = args.srcDir as string;
const outDir = args.outDir as string;
const layout = args.layout;

watchForChanges(srcDir, async (path) => {
  const Layout = layout ? (await import(resolve(Deno.cwd(), layout as string))).default : DevLayout;
  const files = await collect(srcDir);
  const devScript = "/hmr.js";

  if (!path) {
    return files.forEach(async (file) =>
      await writePage(file, files, srcDir, outDir, Layout, devScript)
    );
  }

  await writePage(path, files, srcDir, outDir, Layout, devScript);
}).catch(console.error);

await serve(async (req) => {
  const { pathname } = new URL(req.url);
  if (pathname == "/hmr.js") {
    return new Response(HMR_CLIENT, {
      headers: {
        "content-type": "application/javascript",
      },
    });
  }

  if (pathname == "/hmr") {
    const { response, socket } = Deno.upgradeWebSocket(req);
    HMR_SOCKETS.add(socket);
    socket.onclose = () => {
      HMR_SOCKETS.delete(socket);
    };

    return response;
  }

  return await serveDir(req, { fsRoot: "./dist" });
}, { port: 3000 });
