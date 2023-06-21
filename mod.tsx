// deno-lint-ignore-file no-explicit-any
import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { emptyDir, ensureDir, walk } from "https://deno.land/std@0.192.0/fs/mod.ts";
import { dirname, relative } from "https://deno.land/std@0.192.0/path/mod.ts";
import { extract, test } from "https://deno.land/std@0.192.0/front_matter/any.ts";

import { html, Token, tokens } from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import { slug } from "https://deno.land/x/slug@v1.1.0/mod.ts";
import { h, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { insertAt } from "../orchard/string.ts";

/*
 * [x] Collect md files
 *     [ ] collect html files
 * [ ] Process md files
 *     [x] parse markdown
 *     [x] read frontmatter
 *     [x] get html
 *     [x] replace links
 *         [x] prepend with absolute path
 *         [ ] handle .md links
 *         [x] handle nested links
 *         [x] preserve query strings and headers
 *     [x] create url-safe anchors for headers
 *     [x] return list of headers for a page
 *     [x] return meta from frontmatter
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
 * [ ] HMR
 */

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
  frontmatter?: PostFrontmatter;
}

export async function collect(dir: string) {
  const posts = [];
  for await (const file of walk(dir, { exts: extensions, skip: ignoreNames })) {
    posts.push(relative(dir, file.path));
  }
  return posts;
}

interface PostFrontmatter extends Record<string, unknown> {
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
  frontmatter?: PostFrontmatter;
  headings?: ContentHeading[];
}

export function processMd(
  input: string,
  page: string,
  routes: string[],
  baseUrl: string,
): ContentEntry {
  let frontmatter: PostFrontmatter | undefined;
  let markdown = input;

  if (test(input)) {
    const { attrs, body } = extract(input);
    frontmatter = attrs;
    markdown = body;
  }

  const parsed = tokens(markdown);
  const headings: ContentHeading[] = [];

  // console.log("Before rewrite", page);
  // console.table(parsed);

  parsed.forEach((token, i, ary) => {
    // Rewrite links
    if (token.type === "start" && token.tag === "link" && routes.includes(token.url)) {
      token.url = addExt(baseUrl + token.url);
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

      const slugText = slug(headingText, { remove: /[\s$*_+~.()'"!:@]+/g });

      const tagEndIdx = parsed.slice(i).findIndex((token) =>
        token.type === "end" && token.tag === "heading"
      );
      const headerContent = html(parsed.slice(i + 1, tagEndIdx + i));

      const headerAnchorLink = `<a href="/${addExt(page)}#${slugText}">[link]</a>`;

      const htmlHeader: Token = {
        type: "html",
        content:
          `<h${token.level} id="${slugText}">${headerContent} ${headerAnchorLink}</h${token.level}>`,
      };

      ary.splice(i, tagEndIdx + 1, htmlHeader);

      headings.push({ text: headingText, slug: slugText });
    }
  });

  // console.log("After rewrite");
  // console.table(parsed);
  // console.dir(headings);
  return { html: html(parsed), frontmatter, headings };
}

interface RenderOpts {
  defaultLayout?: (props: LayoutProps) => any;
  routes: string[];
  baseUrl?: string;
}

export async function renderHtml(
  file: string,
  content: string,
  { defaultLayout = DefaultLayout, routes, baseUrl = "" }: RenderOpts,
): Promise<string> {
  const { html, frontmatter } = processMd(
    content,
    file,
    routes,
    baseUrl,
  );
  let LayoutToUse = defaultLayout;

  if (frontmatter) {
    if (frontmatter.layout) {
      try {
        LayoutToUse = (await import(frontmatter.layout)).default;
      } catch (err) {
        console.error(`Couldn't use template ${frontmatter.layout}, using default Layout`);
      }
    }
  }

  if (LayoutToUse !== DefaultLayout) {
    console.debug(
      `Using layout %c${LayoutToUse.name}%c for ${file}`,
      "font-weight: bold",
      "font-weight: normal",
    );
  }

  const rendered = renderSSR(() => (
    <LayoutToUse routes={routes} html={html} frontmatter={frontmatter} />
  ));
  return rendered;
}

export async function main() {
  const args = parse(Deno.args, {
    string: ["srcDir, outDir", "baseUrl"],
    default: {
      srcDir: "./",
      outDir: "./dist",
      baseUrl: "http://localhost:3000",
    },
  });

  await emptyDir(String(args.outDir));
  const files = await collect(String(args.srcDir));
  const routes = files.map((f) => "/" + f.replace(/\.md$/i, ""));

  for await (const file of files) {
    let content: string;
    const page = file.replace(/\.md$/, "");
    try {
      content = await Deno.readTextFile(`${args.srcDir}/${file}`);

      const html = await renderHtml(page, content, { routes });

      const out = `${args.outDir}/${dirname(file.replace(args.srcDir as string, ""))}`;
      await ensureDir(out);

      Deno.writeTextFile(`${args.outDir}/${addExt(page)}`, html);
    } catch (err) {
      console.error(`Couldn't read file ${file}`);
      throw (err);
    }
  }
}

export function addExt(str: string, ext = ".html") {
  return str.includes("#")
    ? insertAt(str, str.indexOf("#"), ext)
    : str.includes("?")
    ? insertAt(str, str.indexOf("?"), ext)
    : str + ext;
}

function DefaultLayout({ html, title = "Blog Title", routes = [] }: LayoutProps) {
  return (
    <html>
      <body>
        <header>
          {title && <h1>{title}</h1>}
          <nav>
            <ul>
              {routes.map((route) => (
                <li>
                  <a href={addExt(route)}>{route}</a>
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

if (import.meta.main) {
  main();
}
