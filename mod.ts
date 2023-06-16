/*
 * [x] Collect md files
 * [ ] Process md files
 * [ ] Get HTML from md
 * [ ] Copy to dist/ folder
 */

const collectionDir = "./";

const ignoreNames = [
  /readme/i,
  /license/i,
  /contributing/i,
  /changelog/i,
];

async function collect() {
  const posts = [];
  for await (const file of Deno.readDir(collectionDir)) {
    if (
      file.isFile && file.name.endsWith(".md") &&
      ignoreNames.some((r) => !r.test(file.name))
    ) {
      posts.push(file);
    }
  }

  console.log(posts);
}

await collect();
