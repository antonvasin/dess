import { html, tokens } from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import { extract, test } from "https://deno.land/std@0.192.0/front_matter/any.ts";
import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";

/*
 * [ ]
 *     [ ]
 *
 * [x] Collect md files
 * [ ] Process md files
 *     [x] parse markdown
 *     [x] read frontmatter
 *     [x] get html
 * [ ] Render static files
 *     [ ] apply layout
 *         [ ] read jsx file from frontmatter
 *         [ ] render html
 *         [ ] insert content into html
 *     [ ] add asset scrpits
 *         [ ] read files from frontmatter
 *         [ ] add <script> to page
 *         [ ] copy asset to /dist
 *     [ ] render final html to file
 * [ ] Copy to dist/ folder
 */

const args = parse(Deno.args);
const collectionDir = args.collectionDir || "./";

const ignoreNames = [
  /readme/i,
  /license/i,
  /contributing/i,
  /changelog/i,
];

async function collect() {
  const posts = [];
  for await (const file of Deno.readDir(collectionDir)) {
    if (
      file.isFile && file.name.endsWith(".md") &&
      ignoreNames.every((r) => !r.test(file.name))
    ) {
      posts.push(file);
    }
  }

  return posts;
}

async function processMd(file: Deno.DirEntry) {
  try {
    const md = await Deno.readTextFile(`${collectionDir}/${file.name}`);
    let frontmatter: Record<string, unknown> | undefined;
    let body = md;

    if (test(md)) {
      frontmatter = extract(md);
      body = frontmatter.body as string;
    }

    const parsed = tokens(body);
    return { html: html(parsed), frontmatter };
  } catch (err) {
    console.error(
      `Couldn't read file ${file.name}. Failed with:\n\n${err.message}`,
    );
    throw (err);
  }
}

for await (const file of await collect()) {
  const { html, frontmatter } = await processMd(file);
  console.log(`File ${file.name}\nHtml:\n${html}`);
  if (frontmatter) {
    console.table(frontmatter.attrs);
  }
}
