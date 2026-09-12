import humanResponse from "./human-response/SKILL.md" with { type: "text" };
import { skillCatalogInstructions } from "./catalog";

/** Gaya respons selalu tersedia; panduan khusus dimuat sesuai kebutuhan. */
export function buildSkillInstructions(): string[] {
  return [humanResponse.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, "").trim(), ...skillCatalogInstructions()];
}
