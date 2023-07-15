# dess

dess = _deno_ + _press_

Creates static website from directory of markdown files.

## Use

Assuming we have folder with `.md` files, we can build static website and save it to `dist`
directory:

```sh
deno run --allow-read --allow-write https://deno.land/x/dess/mod.ts --srcDir=./ --outDir=./dist --layout=./Layout.tsx
```

Or we can do it programmatically:

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
