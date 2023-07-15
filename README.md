# dess

dess = _deno_ + _press_

Creates static website from directory of markdown files.

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
  - [ ] collect html files
  - [ ] collect custom 404 page
  - [ ] skip draft pages
- [ ] Process md files
  - [x] parse markdown
  - [x] read frontmatter
  - [x] get html
  - [x] replace links
    - [x] prepend with absolute path
    - [ ] handle .md links
    - [x] handle nested links
    - [x] preserve query strings and headers
  - [x] create url-safe anchors for headers
  - [x] return list of headers for a page
  - [x] return meta from frontmatter
- [ ] Render static files
  - [x] apply layout
    - [x] read jsx file from frontmatter
    - [x] render html
    - [x] insert content into html
  - [ ] add asset scripts
    - [ ] read files from frontmatter
    - [ ] add <script> to page
    - [ ] copy asset to /dist
  - [x] render final html to file
- [x] Copy to dist/ folder
- [x] copy public files
- [x] HMR
- [ ] RSS
