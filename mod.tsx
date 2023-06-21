// deno-lint-ignore-file no-explicit-any
import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { emptyDir, ensureDir, walk } from "https://deno.land/std@0.192.0/fs/mod.ts";
import { dirname, relative } from "https://deno.land/std@0.192.0/path/mod.ts";
import { extract, test } from "https://deno.land/std@0.192.0/front_matter/any.ts";

import {
  html as renderTokens,
  Token,
  tokens,
} from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import { slug } from "https://deno.land/x/slug@v1.1.0/mod.ts";
import { h, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { insertAt } from "../orchard/string.ts";
import { blue, bold, combineStyle, green, red, reset } from "../orchard/console.ts";

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
 *     [x] apply layout
 *         [x] read jsx file from frontmatter
 *         [x] render html
 *         [x] insert content into html
 *     [ ] add asset scripts
 *         [ ] read files from frontmatter
 *         [ ] add <script> to page
 *         [ ] copy asset to /dist
 *     [x] render final html to file
 * [x] Copy to dist/ folder
 * [x] HMR
 */

const extensions = [".md"];

const ignoreNames = [
  /readme/i,
  /license/i,
  /contributing/i,
  /changelog/i,
];

export async function collect(dir: string) {
  const posts = [];
  for await (const file of walk(dir, { exts: extensions, skip: ignoreNames })) {
    posts.push(file.path);
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
  tokens: Token[];
  headings?: ContentHeading[];
}

export function processMd(
  page: string,
  markdown: string,
  routes: string[],
): ContentEntry {
  const parsed = tokens(markdown);
  const headings: ContentHeading[] = [];

  if (isDebug) {
    console.log(`Tokens for %c${page} %cbefore rewrite:`, bold, reset);
    console.dir(parsed);
  }

  parsed.forEach((token, i, ary) => {
    // Rewrite links
    if (token.type === "start" && token.tag === "link" && routes.includes(token.url)) {
      token.url = addExt(token.url);
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
      const headerContent = renderTokens(parsed.slice(i + 1, tagEndIdx + i));

      const headerAnchorLink = `[<a href="${addExt(page)}#${slugText}">link</a>]`;

      const htmlHeader: Token = {
        type: "html",
        content:
          `<h${token.level} id="${slugText}">${headerContent} ${headerAnchorLink}</h${token.level}>`,
      };

      ary.splice(i, tagEndIdx + 1, htmlHeader);

      headings.push({ text: headingText, slug: slugText });
    }
  });

  if (isDebug) {
    console.log("\nTokens after rewrite:");
    console.dir(parsed);
    console.dir(headings);
  }
  return { tokens: parsed, headings };
}

interface RenderOpts {
  layout?: (props: LayoutProps) => any;
  frontmatter?: PostFrontmatter;
  routes?: string[];
}

export async function renderHtml(
  page: string,
  content: string,
  opts: RenderOpts = {},
): Promise<string> {
  const { layout = DefaultLayout, routes = [], frontmatter } = opts;
  const { tokens, headings } = processMd(
    page,
    content,
    routes,
  );
  let LayoutToUse = layout;

  if (frontmatter) {
    if (frontmatter.layout) {
      try {
        LayoutToUse = (await import(frontmatter.layout)).default;
      } catch (err) {
        console.error(`Couldn't use template ${frontmatter.layout}, using default Layout`);
      }
    }
  }

  if (LayoutToUse !== DefaultLayout && isDebug) {
    console.debug(
      `Using layout %c${LayoutToUse.name}%c for ${page}`,
      combineStyle(bold, blue),
      reset,
    );
  }

  const rendered = renderSSR(() => (
    <LayoutToUse
      routes={routes}
      html={renderTokens(tokens)}
      frontmatter={frontmatter}
      page={page}
      headings={headings}
    />
  ));
  return rendered;
}

export async function writePage(
  path: string,
  files: string[],
  srcDir = ".",
  outDir = "./dist",
  layout: (props: LayoutProps) => any,
) {
  const page = getPageName(path, srcDir);
  const routes = files.map((f) => getPageName(f, srcDir));

  try {
    let content = await Deno.readTextFile(path);
    const opts: RenderOpts = { routes, layout };

    if (test(content)) {
      const { attrs, body } = extract(content);
      content = body;
      opts.frontmatter = attrs;
    }

    const html = await renderHtml(page, content, opts);

    const out = `${outDir}${dirname(page)}`;
    await ensureDir(out);

    Deno.writeTextFile(`${outDir}${addExt(page)}`, html);
  } catch (err) {
    console.error(`Couldn't read file ${path}`);
    throw (err);
  }
}

function addExt(str: string, ext = ".html") {
  return str.includes("#")
    ? insertAt(str, str.indexOf("#"), ext)
    : str.includes("?")
    ? insertAt(str, str.indexOf("?"), ext)
    : str + ext;
}

function getPageName(path: string, srcDir: string) {
  return "/" + relative(srcDir, path).replace(/\.(md|MD)$/, "");
}

export interface LinkProps {
  page: string;
  children?: any;
}

export function PageLink({ page, children }: LinkProps) {
  return <a href={addExt(page, ".html")}>{children}</a>;
}

export interface LayoutProps {
  html: string;
  title?: string;
  page: string;
  routes?: string[];
  headings?: ContentHeading[];
  frontmatter?: PostFrontmatter;
}

export function DefaultLayout({ html, title = "Blog Title", routes = [] }: LayoutProps) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        {title && <title>{title}</title>}
      </head>
      <body>
        <header>
          {title && <h1>{title}</h1>}
          <nav>
            <ul>
              {routes.map((route) => (
                <li>
                  <PageLink page={route}>{route}</PageLink>
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

let isDebug = false;

const usage = `Deno Press
    Creates static website from directory of markdown files.
  USAGE:
    dess [OPTIONS] [COMMAND]
  COMMANDS:
    help      Print this message
    build     Build static website
    serve     Run SSR server
  OPTIONS:
    --srcDir  Source directory with .md files (default: ./)
    --outDir  Destination directory (default: ./dist)
    --debug   Print debug information`;

async function main() {
  const args = parse(Deno.args, {
    string: ["srcDir, outDir", "layout"],
    boolean: ["debug"],
    default: {
      srcDir: "./",
      outDir: "./dist",
    },
  });
  isDebug = Boolean(args.debug);
  const [cmd] = args._;

  const printUsage = () => {
    console.log(usage);
    Deno.exit();
  };

  if (!cmd) {
    printUsage();
  }

  if (cmd === "help") {
    return printUsage();
  } else if (cmd === "build") {
    const srcDir = args.srcDir as string;
    const outDir = args.outDir as string;

    console.info(
      `Building %c${srcDir}%c -> %c${outDir}`,
      combineStyle(bold, green),
      reset,
      combineStyle(bold, green),
    );
    let LayoutToUse = DefaultLayout;
    if (args.layout) {
      try {
        LayoutToUse = (await import(args.layout)).default;
      } catch (err) {
        console.error(
          `Couldn't load layout %c${args.layout}. %cUsing default layout instead.\nFailed with %c${err.message}`,
          bold,
          reset,
          red,
        );
      }
    }

    await emptyDir(outDir);
    const files = await collect(srcDir);

    for (const file of files) {
      if (isDebug) {
        console.debug(
          `\n\n--> Writing %c${file} %cto %c${outDir}`,
          combineStyle(bold, blue),
          reset,
          combineStyle(bold, green),
        );
      }
      await writePage(file, files, srcDir, outDir, LayoutToUse);
    }
    console.info("Done!");
  } else if (cmd === "serve") {
    console.error("Not implemented");
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
