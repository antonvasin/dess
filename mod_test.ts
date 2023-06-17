import { assert } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { emptyDir, exists } from "https://deno.land/std@0.192.0/fs/mod.ts";
import { createHTML } from "./mod.tsx";

Deno.test("writes html files", async () => {
  await createHTML({ srcDir: "./test" });

  assert(await exists("./dist/hello.html"));
  await emptyDir("./dist");
});
