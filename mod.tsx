import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { emptyDir, ensureDir, walk } from "https://deno.land/std@0.192.0/fs/mod.ts";
import { dirname, relative } from "https://deno.land/std@0.192.0/path/mod.ts";

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
 *         [x] handle nested links
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

const extensions = [".md"];

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
  routes?: string[];
}

const addHtmlExt = (str: string) => str + ".html";

function Layout({ children, title = "Blog Title", routes = [] }: Props) {
  return (
    <html>
      <body>
        <header>
          {title && <h1>{title}</h1>}
          <nav>
            <ul>
              {routes.map((route) => (
                <li>
                  <a href={addHtmlExt(route)}>{route}</a>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

export async function collect(dir: string) {
  const posts = [];
  for await (const file of walk(dir, { exts: extensions, skip: ignoreNames })) {
    posts.push(relative(dir, file.path));
  }
  return posts;
}

interface PostFrontmatter {
  layout?: string;
}

export async function processMd(file: string, routes: string[]) {
  try {
    const md = await Deno.readTextFile(file);
    let frontmatter: PostFrontmatter | undefined;
    let body = md;

    if (test(md)) {
      const parsedFm = extract(md);
      frontmatter = parsedFm.attrs;
      body = parsedFm.body as string;
    }

    const parsed = tokens(body);
    // console.log("Before rewrite");
    // console.table(parsed);
    for (const token of parsed) {
      if (token.type === "start" && token.tag === "link" && routes.includes(token.url)) {
        // TODO: use URL to preserve query string
        // TODO: Handle `.md` links
        token.url = addHtmlExt(baseUrl + token.url);
      }
    }

    // console.log("After rewrite");
    // console.table(parsed);
    return { html: html(parsed), options: frontmatter };
  } catch (err) {
    console.error(
      `Couldn't read file ${file}. Failed with:\n\n${err.message}`,
    );
    throw (err);
  }
}

export async function createHTML({ srcDir = collectionDir, out = outDir } = {}) {
  await emptyDir(out);
  const files = await collect(srcDir);
  const routes = files.map((f) => "/" + f.replace(/\.md$/i, ""));

  for await (const file of files) {
    const { html, options } = await processMd(
      `${srcDir}/${file}`,
      routes,
    );
    let LayoutToUse = Layout;

    if (options) {
      if (options.layout) {
        console.info(`Using custom layout ${options.layout} for ${file}`);
        try {
          LayoutToUse = (await import(options.layout)).default;
        } catch (err) {
          console.error(`Couldn't use template ${options.layout}, using default Layout`);
        }
      }
    }

    // FIXME: render without wrapper
    const rendered = renderSSR(
      () => (
        <LayoutToUse routes={routes}>
          <main innerHTML={{ __dangerousHtml: html }} />
        </LayoutToUse>
      ),
    );

    const outDir = `${out}/${dirname(file.replace(srcDir, ""))}`;
    await ensureDir(outDir);

    Deno.writeTextFile(`${out}/${file.replace(/\.md$/, ".html")}`, rendered);
  }
}
