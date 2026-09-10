import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";

/** Utility teks deterministik — tanpa shell/Python untuk operasi kecil. */

/** Unified diff sederhana baris-demi-baris (LCS ringan, cocok untuk teks pendek). */
export function diffLines(a: string, b: string): { line: number; type: "same" | "add" | "del"; text: string }[] {
  const left = a.split("\n");
  const right = b.split("\n");
  const n = left.length;
  const m = right.length;
  // DP LCS dengan batas praktis (teks panjang → gunakan compute python)
  if (n * m > 1_000_000) throw new ToolResultError("VALIDATION_FAILED", "Teks terlalu panjang untuk diff tool (pakai compute:execute_python untuk diff besar).");
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = left[i] === right[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: { line: number; type: "same" | "add" | "del"; text: string }[] = [];
  let i = 0;
  let j = 0;
  let line = 1;
  while (i < n && j < m) {
    if (left[i] === right[j]) { out.push({ line: line++, type: "same", text: left[i]! }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push({ line: line, type: "del", text: left[i]! }); i++; }
    else { out.push({ line: line, type: "add", text: right[j]! }); j++; }
  }
  while (i < n) { out.push({ line: line, type: "del", text: left[i++]! }); }
  while (j < m) { out.push({ line: line, type: "add", text: right[j++]! }); }
  return out;
}

export function createTextTools() {
  return [
    defineTool({ name: "text:diff", connector: "workspace", tags: ["text", "diff", "compare"],
      description: "Bandingkan dua teks baris-demi-baris (add/del/same). Untuk file gunakan git:diff bila dalam repositori.",
      schema: z.object({ left: z.string().max(500_000), right: z.string().max(500_000), contextOnly: z.boolean().default(true) }).strict(),
      parameters: objectSchema({ left: stringField, right: stringField, contextOnly: { type: "boolean" } }, ["left", "right"]),
      execute: async (args) => {
        const all = diffLines(args.left, args.right);
        const changes = args.contextOnly ? all.filter((l) => l.type !== "same") : all;
        return { summary: { added: all.filter((l) => l.type === "add").length, deleted: all.filter((l) => l.type === "del").length }, diff: changes.slice(0, 500) };
      } }),
    defineTool({ name: "text:count", connector: "workspace", tags: ["text", "count", "stats"],
      description: "Hitung baris, kata, karakter teks.",
      schema: z.object({ text: z.string().max(2_000_000) }).strict(),
      parameters: objectSchema({ text: stringField }, ["text"]),
      execute: async (args) => {
        const words = args.text.trim() ? args.text.trim().split(/\s+/).length : 0;
        return { lines: args.text.split("\n").length, words, characters: args.text.length };
      } }),
    defineTool({ name: "text:search", connector: "workspace", tags: ["text", "search", "read"],
      description: "Cari pola dalam satu teks inline (bukan file — untuk file workspace gunakan general:search_code).",
      schema: z.object({ text: z.string().max(2_000_000), query: z.string().min(1).max(500), caseSensitive: z.boolean().default(false), maxResults: z.number().int().min(1).max(200).default(50) }).strict(),
      parameters: objectSchema({ text: stringField, query: stringField, caseSensitive: { type: "boolean" }, maxResults: { type: "integer", minimum: 1, maximum: 200 } }, ["text", "query"]),
      execute: async (args) => {
        const hay = args.caseSensitive ? args.text : args.text.toLowerCase();
        const needle = args.caseSensitive ? args.query : args.query.toLowerCase();
        const matches: { line: number; preview: string }[] = [];
        let total = 0;
        for (const [i, line] of hay.split("\n").entries()) {
          if (!line.includes(needle)) continue;
          total++;
          if (matches.length < args.maxResults) matches.push({ line: i + 1, preview: line.trim().slice(0, 240) });
        }
        return { totalMatches: total, matches };
      } }),
  ];
}
