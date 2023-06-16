import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { exists } from "https://deno.land/std@0.192.0/fs/mod.ts";

import { html, tokens } from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import { extract, test } from "https://deno.land/std@0.192.0/front_matter/any.ts";
import { h, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";

/*
 * [x] Collect md files
 * [ ] Process md files
 *     [x] parse markdown
 *     [x] read frontmatter
 *     [x] get html
 *     [x] replace links
 *         [x] prepend with absolute path
 *         [ ] handle .md links
 *         [ ] handle nested links
 *     [ ] create url-safe anchors for headers
 *     [ ] return list of headers for a page
 *     [ ] return meta from frontmatter
 * [ ] Render static files
 *     [ ] apply layout
 *         [ ] read jsx file from frontmatter
 *         [x] render html
 *         [x] insert content into html
 *     [ ] add asset scripts
 *         [ ] read files from frontmatter
 *         [ ] add <script> to page
 *         [ ] copy asset to /dist
 *     [x] render final html to file
 * [x] Copy to dist/ folder
 */

const args = parse(Deno.args);
const collectionDir = args.collectionDir || "./";
const outDir = args.outDir || "./dist";
const baseUrl = args.baseUrl || "http://localhost:3000";

const ignoreNames = [
  /readme/i,
  /license/i,
  /contributing/i,
  /changelog/i,
];

interface Props {
  // deno-lint-ignore no-explicit-any
  children: any;
  title?: string;
}

function Layout({ children, title = "Anton Vasin" }: Props) {
  return (
    <html>
      <body>
        <header>
          {title && <h1>{title}</h1>}
          <nav>
            <ul>
              <li>
                <a href="/post1">post1</a>
              </li>
              <li>
                <a href="/post2">post2</a>
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

async function processMd(file: string, routes: string[]) {
  try {
    const md = await Deno.readTextFile(file);
    let frontmatter: Record<string, unknown> | undefined;
    let body = md;

    if (test(md)) {
      frontmatter = extract(md);
      body = frontmatter.body as string;
    }

    const parsed = tokens(body);
    // console.log("Before rewrite");
    // console.table(parsed);
    for (let i = 0; i < parsed.length; i++) {
      const token = parsed[i];
      if (token.type === "start" && token.tag === "link" && routes.includes(token.url)) {
        // TODO: use URL to preserve query string
        // TODO: Handle `.md` links
        token.url = baseUrl + token.url + ".html";
      }
    }

    // console.log("After rewrite");
    // console.table(parsed);
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
  const files = await collect(srcDir);
  const routes = files.map((f) => "/" + f.name.replace(/\.md$/i, ""));

  for await (const file of files) {
    const { html, frontmatter } = await processMd(
      `${srcDir}/${file.name}`,
      routes,
    );
    let LayoutToUse = Layout;

    if (frontmatter && frontmatter.attrs && typeof frontmatter.attrs === "object") {
      // console.debug("Frontmatter for file ${file.name}:");
      // console.table(frontmatter.attrs);
      if ("layout" in frontmatter.attrs && typeof frontmatter.attrs.layout === "string") {
        const layoutFile = frontmatter.attrs.layout;
        console.log(`Found custom layout ${layoutFile}`);
        try {
          LayoutToUse = (await import(layoutFile)).default;
        } catch (err) {
          console.error(`Couldn't use template ${layoutFile}, using default Layout`);
        }
      }
    }

    const rendered = renderSSR(
      () => (
        <LayoutToUse>
          <main innerHTML={{ __dangerousHtml: html }} />
        </LayoutToUse>
      ),
    );

    Deno.writeTextFile(`${out}/${file.name.replace(/\.md$/, ".html")}`, rendered);
  }
}
