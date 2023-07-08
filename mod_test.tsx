import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { emptyDir, exists } from "https://deno.land/std@0.192.0/fs/mod.ts";

import { renderHtml } from "./mod.ts";
import { LayoutProps } from "./Components.tsx";

const outDir = "dist";

Deno.test("renderHtml", async (t) => {
  await t.step("render", async () => {
    const pageContent = `# page without frontmatter

  hello world!`;

    const { html } = await renderHtml("/page", pageContent);

    assert(
      html.includes(
        `<h1 id="page-without-frontmatter"><a class='anchor' href="/page.html#page-without-frontmatter">`,
      ),
      "Should include heading with id and self-referencing link",
    );

    const MyLayout = (props: LayoutProps) => (
      <html>
        <body>
          <h1>My Custom Layout</h1>
          <main innerHTML={{ __dangerousHtml: props.html }} />
        </body>
      </html>
    );

    const { html: htmlCustomLayout } = await renderHtml("/page", pageContent, { layout: MyLayout });

    assert(
      htmlCustomLayout.includes("<h1>My Custom Layout</h1"),
      "Should include header from custom layout",
    );
    assert(htmlCustomLayout.includes("hello world!"), "Should include content");
  });

  await t.step({
    name: "js imports",
    // ignore: true,
    async fn() {
      const content = `---
js: './custom_js.ts'
---

# Page title
`;

      const { html } = await renderHtml("/index", content);
      assert(
        html.includes(
          `<script src="custom_js.js" type="module" async=""></script>`,
        ),
        "Includes <script> tag with custom js file",
      );
    },
  });
});

Deno.test(
  "E2E",
  async (t) => {
    await t.step("build", async () => {
      await emptyDir(outDir);

      const cmd = new Deno.Command(Deno.execPath(), {
        args: [
          "run",
          "--allow-read",
          "--allow-write",
          "--allow-sys",
          "--allow-env",
          "--allow-net",
          "mod.ts",
          "build",
          "--srcDir=test",
          `--outDir=${outDir}`,
        ],
        stderr: "inherit",
      });

      const { code, stdout } = await cmd.output();
      const decoder = new TextDecoder();

      assertEquals(code, 0, "Non-zero exit code");
      assertMatch(decoder.decode(stdout), /^Done in \d+ms!$/m);
      assert(await exists(`${outDir}/hello.html`, { isFile: true }));
      assert(await exists(`${outDir}/blog`, { isDirectory: true }));
      // assert(
      //   await exists(`${outDir}/blog/custom.js`, { isFile: true }),
      //   "Custom JS module doesn't exist",
      // );
    });
  },
);
