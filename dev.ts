import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import {
  basename,
  extname,
  join,
  normalize,
  resolve,
} from "https://deno.land/std@0.192.0/path/mod.ts";
import { bold, combineStyle, green, reset } from "../orchard/console.ts";
import { h, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";

import { build, collect, handler, importLayout, writePage } from "./mod.ts";
import { DefaultLayout, RedBox, wrapWithHmr } from "./Components.tsx";

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

async function watchForChanges(postsDirectory: string) {
  const watcher = Deno.watchFs(postsDirectory);

  for await (const event of watcher) {
    if (!(event.kind === "modify" || event.kind === "create")) continue;

    for (const path of event.paths) {
      if (path.startsWith(resolve(outDir))) {
        continue;
      } else if (extname(path) === ".md") {
        performance.mark("start-refresh");

        try {
          console.info(`File ${path} changed. Building…`);
          const Layout = layoutPath
            ? await importLayout(
              resolve(Deno.cwd(), layoutPath as string),
            )
            : DefaultLayout;
          const files = await collect(srcDir);

          await writePage(path, files, srcDir, outDir, wrapWithHmr(Layout));
          performance.mark("end-refresh");
          const refreshDur = performance.measure("refresh time", "start-refresh", "end-refresh");
          console.info(`Refreshed in ${refreshDur.duration.toFixed(2)}ms`);
          HMR_SOCKETS.forEach((socket) => {
            socket.send(JSON.stringify({ type: "refresh" }));
          });
        } catch (err) {
          console.error(`${path} error:`, err);
        }
      } else if (path.includes("/public")) {
        try {
          const file = await Deno.stat(path);
          if (file.isDirectory) {
            continue;
          }

          console.info(
            `Public file %c${path}%c changed…`,
            combineStyle(green, bold),
            reset,
          );
          // XXX: Deno.copyFile modifies source file resulting in infinite loop https://github.com/denoland/deno/issues/19425
          // await Deno.copyFile(path, join(outDir, "/public", basename(path)));
          await Deno.writeFile(join(outDir, "/public", basename(path)), Deno.readFileSync(path));
          HMR_SOCKETS.forEach((socket) => {
            socket.send(JSON.stringify({ type: "refresh" }));
          });
        } catch (err) {
          if (err instanceof Deno.errors.NotFound) {
            continue;
          }
          throw err;
        }
      }
    }
  }
}

const args = parse(Deno.args, {
  string: ["srcDir, outDir", "layout", "port"],
  boolean: ["debug"],
  default: {
    srcDir: "./",
    outDir: "./dist",
    port: "3000",
  },
});

const srcDir = normalize(String(args.srcDir));
const outDir = normalize(String(args.outDir));
const port = Number(args.port);
const layoutPath = args.layout;

const layout = layoutPath
  ? (await import(resolve(Deno.cwd(), layoutPath as string))).default
  : DefaultLayout;
await build({ srcDir, outDir, layout: wrapWithHmr(layout) });
watchForChanges(srcDir).catch(console.error);

await serve((req) => {
  try {
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

    return handler(req, outDir);
  } catch (error) {
    return new Response(renderSSR(h(RedBox, { err: error })), {
      status: 500,
      headers: { "content-type": "text/html" },
    });
  }
}, { port });
