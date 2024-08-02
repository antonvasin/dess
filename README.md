# dess

dess = _deno_ + _press_

Creates static website from directory of markdown files with JSX templates.

It supports Obsidian note format and is like leaner and meaner cousin of
[qartz](https://quartz.jzhao.xyz).

## TODO

- [x] Collect md files
- [ ] Skip draft pages
  - `draft: true` in attributes
  - Filename or parent folder name starts with `__`
- [x] Process md files
  - [x] parse markdown
  - [x] read frontmatter
  - [x] get html
  - [x] replace links
  - [x] prepend with absolute path
  - [x] handle nested links
  - [x] preserve query strings and headers
  - [x] create url-safe anchors for headers
  - [x] return list of headers for a page
  - [ ] Read H1 from file and use it as title. H1 title > frontmatter title > filename
  - [ ] Don't depend on
        [`deno_rusty_markdown`](https://github.com/arguablykomodo/deno_rusty_markdown)
- [ ] Handle Obsidian/wiki links
  - [ ] Resolve ambiguous links (`Note` matches `folder/Note`)
  - [ ] Collect backlinks and pass to template
  - [ ] Support aliases
  - [ ] Support custom link name
  - [ ] Support links to headings/sections
  - [ ] Support links to blocks
  - [ ] Embed images/files
- [x] Return meta from frontmatter
- [x] Render static files
  - [x] apply layout
  - [x] Add asset scripts
- [x] Copy public files
- [ ] HTML files support
  - [ ] Only copy used resources: parse HTML file head and copy files references in `link`s and
        `script`s
  - https://docs.deno.com/runtime/manual/advanced/jsx_dom/deno_dom
- [x] HMR
- [ ] Generate RSS feed
- [ ] Generate sitemap
- [x] Static file server
  - [ ] Support routes without extensions
  - [x] respond with custom 404 page
  - [ ] Custom 404 page
- [ ] Static code highlighting with minimal css
- [ ] (frames|Turbolinks|htmx)-like navigation: fetch remote html and replace current `body` with
      result
  - [ ] Support transitions in custom layouts
  - https://github.com/Kalabasa/htmz
- [ ] Versioning via git
  - [ ] Pin page version to commit; don't lock other pages
