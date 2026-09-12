import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

/** Snapshot resources untuk Bun bundle; file pendukung dibaca sebagai teks, tidak dieksekusi. */
export async function bundleSkills(root = resolve(import.meta.dir, "..")) {
  const resources: Record<string, string> = {};
  const vendor = resolve(root, "skills/vendor");
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) resources[relative(vendor, file).replaceAll("\\", "/")] = await readFile(file, "utf8");
    }
  }
  await walk(vendor);
  for (const name of ["attachments", "pdf", "office", "image"]) {
    resources[`${name}/SKILL.md`] = await readFile(resolve(root, `apps/api/src/agent/skills/${name}/SKILL.md`), "utf8");
  }
  await writeFile(resolve(root, "apps/api/src/agent/skills/resources.json"), JSON.stringify(resources, null, 2) + "\n");
}

if (import.meta.main) await bundleSkills();
