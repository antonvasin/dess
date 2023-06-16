import { html, tokens } from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import { extract, test } from "https://deno.land/std@0.192.0/front_matter/any.ts";
import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { h, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { exists } from "https://deno.land/std@0.192.0/fs/mod.ts";

/*
 * [ ]
 *     [ ]
 *
 * [x] Collect md files
 * [ ] Process md files
 *     [x] parse markdown
 *     [x] read frontmatter
 *     [x] get html
 *     [ ] replace links
 * [ ] Render static files
 *     [ ] apply layout
 *         [ ] read jsx file from frontmatter
 *         [x] render html
 *         [x] insert content into html
 *     [ ] add asset scrpits
 *         [ ] read files from frontmatter
 *         [ ] add <script> to page
 *         [ ] copy asset to /dist
 *     [x] render final html to file
 * [x] Copy to dist/ folder
 */

const args = parse(Deno.args);
const collectionDir = args.collectionDir || "./";
const outDir = args.outDir || "./dist";

const ignoreNames = [
  /readme/i,
  /license/i,
  /contributing/i,
  /changelog/i,
];

interface Props {
  // deno-lint-ignore no-explicit-any
  children: any;
}

function Layout({ children }: Props) {
  return (
    <html>
      <body>
        <header>
          <h1>Anton Vasin</h1>
          <nav>
            <ul>
              <li>
                <a href="/music">Music</a>
              </li>
            </ul>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

async function collect(dir: string) {
  const posts = [];
  for await (const file of Deno.readDir(dir)) {
    if (
      file.isFile && file.name.endsWith(".md") &&
      ignoreNames.every((r) => !r.test(file.name))
    ) {
      posts.push(file);
    }
  }

  return posts;
}

async function processMd(file: string) {
  try {
    const md = await Deno.readTextFile(file);
    let frontmatter: Record<string, unknown> | undefined;
    let body = md;

    if (test(md)) {
      frontmatter = extract(md);
      body = frontmatter.body as string;
    }

    const parsed = tokens(body);
    console.table(parsed);
    return { html: html(parsed), frontmatter };
  } catch (err) {
    console.error(
      `Couldn't read file ${file}. Failed with:\n\n${err.message}`,
    );
    throw (err);
  }
}

export async function createHTML({ srcDir = collectionDir, out = outDir } = {}) {
  if (await exists(outDir)) {
    await Deno.remove(outDir, { recursive: true });
  }
  await Deno.mkdir(outDir);
  for await (const file of await collect(srcDir)) {
    const { html, frontmatter } = await processMd(`${srcDir}/${file.name}`);

    if (frontmatter) {
      // console.debug("Frontmatter for file ${file.name}:");
      // console.table(frontmatter.attrs);
    }

    const rendered = renderSSR(
      () => (
        <Layout>
          <main innerHTML={{ __dangerousHtml: html }} />
        </Layout>
      ),
    );

    Deno.writeTextFile(`${out}/${file.name.replace(/\.md$/, ".html")}`, rendered);
  }
}
