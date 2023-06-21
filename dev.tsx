import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { collect, LayoutProps, PageLink, writePage } from "./mod.tsx";

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
        <script src="/hmr.js" type="module" async></script>
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
      for (const path of event.paths) {
        if (path.endsWith(".md")) {
          try {
            console.info(`File ${path} changed. Building…`);
            await updateFn(path);
            performance.mark("end-refresh");
            const refreshDur =
              performance.measure("refersh time", "start-refresh", "end-refresh").duration;
            console.info(`Refershed in ${refreshDur.toFixed(2)}ms`);
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

watchForChanges("./test", async (path) => {
  const files = await collect("./test");
  if (!path) {
    return files.forEach(async (file) =>
      await writePage(file, files, "./test", "./dist", DevLayout)
    );
  }

  await writePage(path, files, "./test", "./dist", DevLayout);
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
