import { z } from "zod";
import resources from "../../agent/skills/resources.json";
import { SKILL_CATALOG } from "../../agent/skills/catalog";
import { defineTool, objectSchema, stringField } from "../types";

const PAGE_CHARS = 4000;

export function createSkillReadTool() {
  return defineTool({ name: "skills:read", connector: "workspace", tags: ["skills", "panduan", "design", "debug", "review"],
    description: "Baca skill yang relevan dari katalog sistem sesuai kebutuhan. Default SKILL.md; resource menunjuk referensi relatif. Ikuti nextOffset hingga null. Tidak membaca workspace pengguna dan tidak menjalankan skrip.",
    schema: z.object({ name: z.string().min(1).max(100), resource: z.string().min(1).max(200).default("SKILL.md"), offset: z.number().int().min(0).default(0) }).strict(),
    parameters: objectSchema({ name: stringField, resource: stringField, offset: { type: "integer", minimum: 0 } }, ["name"]),
    execute: async ({ name, resource, offset }) => {
      if (!SKILL_CATALOG.some((s) => s.name === name)) throw new Error("Skill tidak tersedia di katalog.");
      const key = `${name}/${resource}`;
      const library = resources as Record<string, string>;
      if (!Object.hasOwn(library, key)) throw new Error("Referensi skill tidak tersedia. Gunakan nama resource persis dari daftar.");
      const source = library[key]!;
      return { name, resource, offset, content: source.slice(offset, offset + PAGE_CHARS),
        nextOffset: offset + PAGE_CHARS < source.length ? offset + PAGE_CHARS : null,
        ...(resource === "SKILL.md" && offset === 0 ? { resources: Object.keys(library).filter((p) => p.startsWith(`${name}/`)).map((p) => p.slice(name.length + 1)) } : {}) };
    } });
}
