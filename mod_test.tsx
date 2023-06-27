import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { assert } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { renderHtml } from "./mod.ts";
import { LayoutProps } from "./Components.tsx";

Deno.test("renderHtml", async () => {
  const pageContent = `# page without frontmatter

  hello world!`;

  const html = await renderHtml("/page", pageContent);

  assert(
    html.includes(
      `<h1 id="page-without-frontmatter"><a class='anchor' href="/page.html#page-without-frontmatter">link</a> page without frontmatter</h1>`,
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

  const htmlCustomLayout = await renderHtml("/page", pageContent, { layout: MyLayout });

  assert(
    htmlCustomLayout.includes("<h1>My Custom Layout</h1"),
    "Should include header from custom layout",
  );
  assert(htmlCustomLayout.includes("hello world!"), "Should include content");
});
