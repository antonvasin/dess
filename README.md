# dess

dess = _deno_ + _press_

Creates static website from directory of markdown files with JSX templates.

It supports Obsidian note format and is like leaner and meaner cousin of
[qartz](https://quartz.jzhao.xyz).

## Design

- Base entity is a markdown page
- Page can have it's own layout, scripts and styles
- Functionality should be extended programmatically, instead of using plugin system
- Obsidian markdown note is supported
- Written to be as fast as possible with minimal amount of code and dependencies

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
