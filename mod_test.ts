import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { emptyDir, ensureDir, exists } from "https://deno.land/std@0.192.0/fs/mod.ts";
import { dirname, join } from "https://deno.land/std@0.192.0/path/mod.ts";

import { renderHtml } from "./mod.ts";
import TestLayout from "./test/test_layout.tsx";
import { random } from "../orchard/number.ts";

const outDir = "./__test_output";
const fixturesDir = "./__test_input";

function pageTemplate(title: string, paths: string[], linkPerPage: number) {
  let page = `---
title: ${title}
publish: true
---

# ${title}
`;
  const links = [];
  for (let i = 0; i < linkPerPage; i++) {
    links.push(`- [[${paths[random(0, paths.length)]}]]`);
  }
  page += "\n";
  page += links.join("\n");
  return page;
}

function generatePaths(pagesCount: number) {
  const paths = [];
  for (let i = 0; i < pagesCount; i++) {
    paths.push(`folder_${random(1, 4)}/Note_${i}`);
  }
  return paths;
}

async function generateTestPages(pagesCount = 1000, linksPerPage = 10) {
  const pages = generatePaths(pagesCount);
  await emptyDir(fixturesDir);
  for (const path of pages) {
    await ensureDir(join(fixturesDir, dirname(path)));

    Deno.writeTextFile(join(fixturesDir, path) + ".md", pageTemplate(path, pages, linksPerPage));
  }
}

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

    const { html: htmlCustomLayout } = await renderHtml("/page", pageContent, {
      layout: TestLayout,
    });

    assert(
      htmlCustomLayout.includes("<h1>This is a test layout</h1"),
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
  { ignore: !Deno.args.includes("e2e") },
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
      assert(
        await exists(`${outDir}/blog/custom.js`, { isFile: true }),
        "Custom JS module doesn't exist",
      );
    });

    await t.step("stress test", async () => {
      await emptyDir(outDir);
      await generateTestPages(1000, 10);
      assert(await exists(`${fixturesDir}/folder_1`, { isDirectory: true }));

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
          `--srcDir=${fixturesDir}`,
          `--outDir=${outDir}`,
          `--layout=test/test_layout.tsx`,
        ],
        stderr: "inherit",
      });

      await cmd.output();
      assert(await exists(`${outDir}/folder_1`, { isDirectory: true }));
    });
  },
);
