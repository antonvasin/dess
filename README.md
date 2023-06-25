# dess

dess = _deno_ + _press_

Creates static website from directory of markdown files.

## Usage

```ts
import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { build } from "https://deno.land/x/dess/mod.ts";
import MyCustomLayout from "./MyCustomLayout.tsx";

await build({
  srcDir: "./content",
  outDir: "./dist",
  layout: MyCustomLayout,
});
```

or

```sh
deno run --allow-read --allow-write https://deno.land/x/dess/mod.ts --srcDir=./ --outDir=./dist --layout=./Layout.tsx
```
