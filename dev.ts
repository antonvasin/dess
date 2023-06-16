import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createHTML } from "./mod.tsx";

console.info("Building…");
await createHTML({ srcDir: "./test" });

await serve((req) =>
  serveDir(req, {
    fsRoot: "./dist",
  }), { port: 3000 });
