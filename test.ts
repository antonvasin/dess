import { ensureDir } from "https://deno.land/std@0.192.0/fs/mod.ts";
import { random } from "../orchard/number.ts";
import { dirname, join } from "https://deno.land/std@0.192.0/path/mod.ts";
import { emptyDir } from "https://deno.land/std@0.192.0/fs/empty_dir.ts";

const testDir = "./__testNotes";

function pageTemplate(title: string, paths: string[], linkPerPage: number) {
  let page = `# ${title}\n\n`;
  const links = [];
  for (let i = 0; i < linkPerPage; i++) {
    links.push(`- [[${paths[random(0, paths.length)]}]]`);
  }
  page += links.join("\n");
  return page;
}

function generatePaths(pagesCount: number) {
  const paths = [];
  for (let i = 0; i < pagesCount; i++) {
    paths.push(`folder_${random(1, 4)}/Note_${i}`);
  }
  return paths;
}

export async function generateTestPages(pagesCount = 1000, linksPerPage = 10) {
  const pages = generatePaths(pagesCount);
  await emptyDir(testDir);
  for (const path of pages) {
    await ensureDir(join(testDir, dirname(path)));

    Deno.writeTextFile(join(testDir, path) + ".md", pageTemplate(path, pages, linksPerPage));
  }
}
