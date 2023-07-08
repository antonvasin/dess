import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { emptyDir, ensureDir, exists, walk } from "https://deno.land/std@0.192.0/fs/mod.ts";
import {
  basename,
  dirname,
  join,
  normalize,
  relative,
  resolve,
} from "https://deno.land/std@0.192.0/path/mod.ts";
import { extract, test } from "https://deno.land/std@0.192.0/front_matter/any.ts";
import {
  html as renderTokens,
  Token,
  tokens,
} from "https://deno.land/x/rusty_markdown@v0.4.1/mod.ts";
import { bundle } from "https://deno.land/x/emit@0.24.0/mod.ts";
import { slug } from "https://deno.land/x/slug@v1.1.0/mod.ts";
import { h, Helmet, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { insertAt } from "../orchard/string.ts";
import { formatDuration } from "../orchard/time.ts";
import { blue, bold, combineStyle, green, red, reset } from "../orchard/console.ts";
import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts";
import { serve as _serve, ServeInit } from "https://deno.land/std@0.192.0/http/server.ts";
import { DefaultLayout, LayoutComponent, NotFound } from "./Components.tsx";
import { Status } from "https://deno.land/std@0.192.0/http/http_status.ts";

const extensions = [".md"];
const publicDir = "public";
const ignoreNames = [
  /readme/i,
  /license/i,
  /contributing/i,
  /changelog/i,
  /node_modules/i,
  // ignore dotfiles
  /\/\./,
];

export async function collect(dir: string) {
  const posts = [];
  for await (const file of walk(dir, { exts: extensions, skip: ignoreNames })) {
    posts.push(file.path);
  }
  return posts;
}

export interface PostFrontmatter extends Record<string, unknown> {
  /** Path to custom lalyout */
  layout?: string;
  /** Custom page title */
  title?: string;
  /** Custom page slug */
  slug?: string;
  /** Publish date */
  date?: string;
  /** Custom js path */
  js?: string | string[];
}

export interface ContentHeading {
  slug: string;
  text: string;
}

export interface ContentEntry {
  tokens: Token[];
  headings?: ContentHeading[];
}

export function processMd(
  page: string,
  markdown: string,
  routes: string[],
): ContentEntry {
  const parsed = tokens(markdown, {
    footnotes: true,
    tasklists: true,
    strikethrough: true,
    tables: true,
  });
  const headings: ContentHeading[] = [];

  if (isDebug) {
    console.log(`Tokens for %c${page} %cbefore rewrite:`, bold, reset);
    console.dir(parsed);
  }

  parsed.forEach((token, i, ary) => {
    // Rewrite links
    if (
      token.type === "start" && token.tag === "link" &&
      routes.includes(token.url)
    ) {
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

      const headerAnchorLink = `<a class='anchor' href="${addExt(page)}#${slugText}">§</a>`;

      const htmlHeader: Token = {
        type: "html",
        content:
          `<h${token.level} id="${slugText}">${headerAnchorLink} ${headerContent}</h${token.level}>`,
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
  layout?: LayoutComponent;
  routes?: string[];
}

export async function importLayout(path: string | undefined, fallback?: LayoutComponent) {
  if (!path) {
    return fallback;
  }

  try {
    return (await import(path)).default || fallback;
  } catch (err) {
    console.error(
      `Couldn't load layout %c${path}. %cUsing ${fallback?.name} instead.\nFailed with %c${err.message}`,
      bold,
      reset,
      red,
    );
  }
}

export async function renderHtml(
  page: string,
  content: string,
  opts: RenderOpts = {},
): Promise<{ html: string; assets?: string[] }> {
  const { layout = DefaultLayout, routes = [] } = opts;
  let input = content;
  let frontmatter: PostFrontmatter = {};
  if (test(content)) {
    const { attrs, body } = extract(content);
    input = body;
    frontmatter = attrs;
  }

  const { tokens, headings } = processMd(
    page,
    input,
    routes,
  );
  const Layout = await importLayout(frontmatter?.layout, layout);

  let scripts: string[] | undefined;
  if (frontmatter?.js) {
    if (Array.isArray(frontmatter?.js)) {
      scripts = frontmatter.js.map(normalize);
    } else {
      scripts = [normalize(frontmatter.js)];
    }
  }

  if (Layout !== DefaultLayout && isDebug) {
    console.debug(
      `Using layout %c${Layout.name}%c for ${page}`,
      combineStyle(bold, blue),
      reset,
    );
  }

  const rendered = renderSSR(
    h(
      Layout,
      {
        routes,
        html: renderTokens(tokens),
        frontmatter,
        page,
        headings,
      },
      scripts?.length
        ? scripts.map((script) =>
          h(Helmet, {}, [h("script", {
            src: script.replace(/\.ts(x?)$/i, ".js"),
            type: "module",
            async: "",
          })])
        )
        : undefined,
    ),
  );

  const { head, body, footer, attributes } = Helmet.SSR(rendered);
  const html = `<!DOCTYPE html>
  <html ${attributes.html.toString()}>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${head.join("\n")}
    </head>
    <body ${attributes.body.toString()}>
    ${body}
    ${footer.join("\n")}
  </body>
</html>`;
  return { html, assets: scripts };
}

export async function writePage(
  path: string,
  files: string[],
  srcDir = ".",
  outDir = "./dist",
  layout = DefaultLayout,
) {
  const page = getPageName(path, srcDir);
  const routes = files.map((f) => getPageName(f, srcDir));

  try {
    const content = await Deno.readTextFile(path);
    const opts: RenderOpts = { routes, layout };

    const { html, assets = [] } = await renderHtml(page, content, opts);

    const out = `${outDir}${dirname(page)}`;
    await ensureDir(out);

    for (const asset of assets) {
      const js = await bundle(
        resolve(join(srcDir, asset)),
        { compilerOptions: { sourceMap: false, checkJs: true } },
      );
      const filename = join(outDir, asset).replace(/.ts(x?)$/, ".js");
      console.info(`Writing %c${filename}…`, green);
      await Deno.writeTextFile(
        filename,
        js.code,
      );
    }

    Deno.writeTextFile(`${outDir}${addExt(page)}`, html);
  } catch (err) {
    console.error(`Couldn't read file ${path}`);
    throw (err);
  }
}

export async function copyPublic(srcDir: string, outDir: string) {
  await ensureDir(join(outDir, publicDir));
  for await (
    const file of walk(resolve(srcDir, publicDir), { skip: ignoreNames })
  ) {
    if (file.isFile) {
      const path = join(outDir, publicDir, basename(file.path));
      if (isDebug) {
        console.debug(
          `Copying static file %c${basename(file.path)}`,
          combineStyle(green, bold),
        );
      }

      await Deno.copyFile(file.path, path);
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

function getPageName(path: string, srcDir: string) {
  return "/" + relative(srcDir, path).replace(/\.(md|MD)$/, "");
}

export interface BuildOpts {
  srcDir: string;
  outDir: string;
  layout: LayoutComponent;
}

export async function build({ srcDir, outDir, layout }: BuildOpts) {
  performance.mark("build");

  const Layout = layout;
  console.info(
    `Building %c${srcDir}%c -> %c${outDir}`,
    combineStyle(bold, green),
    reset,
    combineStyle(bold, green),
  );

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
    await writePage(file, files, srcDir, outDir, Layout);
  }

  if (await exists(join(srcDir, publicDir), { isDirectory: true, isReadable: true })) {
    await copyPublic(srcDir, outDir);
  }

  performance.mark("build-end");
}

export async function handler(req: Request, dir: string) {
  const res = await serveDir(req, { fsRoot: dir });
  if (res.status === Status.NotFound) {
    return new Response(
      renderSSR(() => h(NotFound, { url: req.url }, {})),
      {
        status: 404,
        headers: { "content-type": "text/html" },
      },
    );
  }
  return res;
}

function serve(dir: string, opts?: ServeInit) {
  _serve((req) => handler(req, dir), opts);
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
    dev       Run dev server
  OPTIONS:
    --srcDir  Source directory with .md files (default: ./)
    --outDir  Destination directory (default: ./dist)
    --port    Server port to use
    --debug   Print debug information`;

async function main() {
  const args = parse(Deno.args, {
    string: ["srcDir, outDir", "layout"],
    boolean: ["debug"],
    default: {
      srcDir: "./",
      outDir: "./dist",
      port: "3000",
    },
  });
  isDebug = Boolean(args.debug);
  const srcDir = String(args.srcDir);
  const outDir = String(args.outDir);
  const port = Number(args.port);
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
    let LayoutToUse = DefaultLayout;
    if (args.layout) {
      LayoutToUse = await importLayout(resolve(Deno.cwd(), args.layout), DefaultLayout);
    }

    await build({ srcDir, outDir, layout: LayoutToUse });
    const buildTime = performance.measure("boild-time", "build", "build-end");
    console.info(`Done in ${formatDuration(buildTime.duration)}!`);
  } else if (cmd === "serve") {
    serve(outDir, { port });
  } else if (cmd === "dev") {
    throw new Error("Not implemented");
  }
}

if (import.meta.main) {
  main();
}
