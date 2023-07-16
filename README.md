# dess

dess = _deno_ + _press_

Creates static website from directory of markdown files with JSX templates.

It supports Obsidian note format and is similar to [qartz](https://quartz.jzhao.xyz) or self-host
Obsidian Publish alternatives but it is not exclusively for use with Obsidian.

## Use

```sh
deno run --allow-read --allow-write https://deno.land/x/dess/mod.ts --srcDir=./pages --layout=./Layout.tsx
```

| Arg        | Description                                         |
| ---------- | --------------------------------------------------- |
| `--srcDir` | Path to folder with markdown files _(default: `.`)_ |
| `--outDir` | Output folder _(default: `dist`)_                   |
| `--layout` | Path to `.jsx` or `.tsx` layout file                |

Or programmatically:

```ts
import { build } from "https://deno.land/x/dess/mod.ts";
import MyCustomLayout from "./MyCustomLayout.tsx";

await build({
  srcDir: "./content",
  outDir: "./dist",
  layout: MyCustomLayout,
});
```

## TODO

- [x] Collect md files
  - [ ] skip draft pages
- [ ] Process md files
  - [x] parse markdown
  - [x] read frontmatter
  - [x] get html
  - [x] replace links
    - [x] prepend with absolute path
    - [ ] handle Obsidian/wiki links
      - [ ] resolve ambiguous links (`Note` matches `folder/Note`)
    - [x] handle nested links
    - [x] preserve query strings and headers
  - [ ] collect backlinks and pass to template
  - [x] create url-safe anchors for headers
  - [x] return list of headers for a page
  - [x] return meta from frontmatter
- [x] Render static files
  - [x] apply layout
    - [x] read jsx file from frontmatter
    - [x] render html
    - [x] insert content into html
    - [x] create html files
  - [x] add asset scripts
    - [x] read files from frontmatter
    - [x] add <script>s to page
    - [x] bundle asset to /dist
- [x] copy public files
- [ ] support HTML pages -> copy as is to dist
- [x] HMR
- [ ] Generate RSS file
- [ ] Generate sitemap
- [ ] microserver
  - [ ] support extensionless routes
  - [x] respond with custom 404 page
  - [ ] can pass your own 404
