import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { emptyDir, ensureDir, walk } from "https://deno.land/std@0.192.0/fs/mod.ts";
import { dirname, relative } from "https://deno.land/std@0.192.0/path/mod.ts";

import { html, Token, tokens } from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import { slug } from "https://deno.land/x/slug@v1.1.0/mod.ts";
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
 *         [x] read jsx file from frontmatter
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

export interface LayoutProps {
  html: string;
  title?: string;
  routes?: string[];
  headings?: ContentHeading[];
}

const addHtmlExt = (str: string) => str + ".html";

function Layout({ html, title = "Blog Title", routes = [] }: LayoutProps) {
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
        <main innerHTML={{ __dangerousHtml: html }} />
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
  title?: string;
  slug?: string;
  date?: string;
}

interface ContentHeading {
  slug: string;
  text: string;
}

interface ContentEntry {
  html: string;
  options?: PostFrontmatter;
  headings?: ContentHeading[];
}

export async function processMd(file: string, routes: string[]): Promise<ContentEntry> {
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
    const headings: ContentHeading[] = [];
    console.log("Before rewrite", file);
    console.table(parsed);

    parsed.forEach((token, i, ary) => {
      // Rewrite links
      if (token.type === "start" && token.tag === "link" && routes.includes(token.url)) {
        // TODO: use URL to preserve query string
        // TODO: Handle `.md` links
        token.url = addHtmlExt(baseUrl + token.url);
      }

      // Rewrite headings
      if (token.type === "start" && token.tag === "heading") {
        let headingText = "";
        for (const token of parsed.slice(i)) {
          if (token.type === "text") {
            headingText += token.content;
          }
          if (token.type === "end" && token.tag === "heading") {
            break;
          }
        }
        const slugText = slug(headingText);

        const endIdx = parsed.slice(i).findIndex((token) =>
          token.type === "end" && token.tag === "heading"
        );
        const headerContent = html(parsed.slice(i + 1, endIdx + i));
        const htmlHeader: Token = {
          type: "html",
          content: `<h${token.level} id="${slugText}">${headerContent}</h${token.level}>`,
        };

        ary.splice(i, endIdx + 1, htmlHeader);

        headings.push({ text: headingText, slug: slugText });
      }
    });

    console.log("After rewrite");
    console.table(parsed);
    console.dir(headings);
    return { html: html(parsed), options: frontmatter, headings };
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

    const rendered = renderSSR(() => <LayoutToUse routes={routes} html={html} />);

    const outDir = `${out}/${dirname(file.replace(srcDir, ""))}`;
    await ensureDir(outDir);

    Deno.writeTextFile(`${out}/${file.replace(/\.md$/, ".html")}`, rendered);
  }
}
