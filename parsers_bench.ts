import * as rusty from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import * as rsmsmd from "https://deno.land/x/markdown_wasm/mod.ts";
import markdownit from "npm:markdown-it";

const page = `# Page title

This is a markdown page.

## TODO {#todo}

- [ ] To do
- [x] Done

## Table

| Heading | Heading |
| ------- | ------- |
|  value  |  value  |
`;

Deno.bench("rusty_markdown", { baseline: true }, () => {
  rusty.html(rusty.tokens(page));
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();
Deno.bench("markdown-wasm", () => {
  rsmsmd.parseMarkdown(page, {
    onCodeBlock(_tag, body) {
      return encoder.encode(decoder.decode(body));
    },
  });
});

Deno.bench("markdown-it", () => {
  const md = markdownit();
  md.render(page);
});
