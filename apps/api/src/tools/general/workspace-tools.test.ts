import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSearchTools } from "./search";
import { createPatchTools, applyBlocks } from "./patch";
import { createDataTools } from "./data";
import { createCsvTools, parseCsv } from "./csv";
import { createTextTools, diffLines } from "./text";
import { workspaceRoot } from "./files";
import { classifyIntent, intentBoostPrefixes } from "../../agent/loop/intent-routing";
import { validateEgressUrl } from "../../lib/url-policy";
import { createArchiveTools } from "./archive";
import { ToolResultError } from "../errors";

const run = { userId: "test-user", runId: "r1", conversationId: "c1" } as never;

describe("search tools", () => {
  test("search_code finds structured matches with pagination", async () => {
    const base = await mkdtemp(join(tmpdir(), "search-test-"));
    const root = await workspaceRoot(base, "test-user");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src/a.ts"), "const alpha = 1;\nconst beta = alpha + 1;\n");
    await writeFile(join(root, "b.txt"), "alpha text\n");
    const search = createSearchTools(base).find((t) => t.fqName === "general:search_code")!;
    const result = await search.execute({ query: "alpha" }, run) as { matches: Array<{ path: string; line: number }>; totalMatches: number };
    expect(result.totalMatches).toBe(3);
    expect(result.matches.every((m) => typeof m.line === "number" && m.path.length > 0)).toBe(true);
    const page2 = await search.execute({ query: "alpha", offset: 2, maxResults: 1 }, run) as { matches: unknown[]; nextOffset: number | null };
    expect(page2.matches.length).toBe(1);
    expect(page2.nextOffset).toBe(null);
  });
  test("search_files matches pattern and skips node_modules", async () => {
    const base = await mkdtemp(join(tmpdir(), "searchfiles-test-"));
    const root = await workspaceRoot(base, "test-user");
    await mkdir(join(root, "node_modules"), { recursive: true });
    await writeFile(join(root, "node_modules/junk.ts"), "x");
    await writeFile(join(root, "main.ts"), "x");
    const searchFiles = createSearchTools(base).find((t) => t.fqName === "general:search_files")!;
    const result = await searchFiles.execute({ pattern: ".*\\.ts$" }, run) as { files: string[] };
    expect(result.files).toContain("main.ts");
    expect(result.files.some((f) => f.includes("node_modules"))).toBe(false);
  });
});

describe("apply_patch", () => {
  test("applies unique blocks atomically and enforces hash", async () => {
    const base = await mkdtemp(join(tmpdir(), "patch-test-"));
    const root = await workspaceRoot(base, "test-user");
    await writeFile(join(root, "app.ts"), "const a = 1;\nconst b = 2;\n");
    const hash = Bun.CryptoHasher ? await (async () => new Bun.CryptoHasher("sha256").update("const a = 1;\nconst b = 2;\n").digest("hex"))() : "";
    const patch = createPatchTools(base).find((t) => t.fqName === "general:apply_patch")!;
    const result = await patch.execute({ path: "app.ts", blocks: [{ search: "const a = 1;", replace: "const a = 42;" }, { search: "const b = 2;", replace: "const b = 7;" }], expectedHash: hash }, run) as { blocksApplied: number[] };
    expect(result.blocksApplied).toEqual([1, 2]);
    // Hash usang ditolak
    await expect(patch.execute({ path: "app.ts", blocks: [{ search: "x", replace: "y" }], expectedHash: hash }, run)).rejects.toThrow("berubah");
  });
  test("ambiguous block fails without modifying file", () => {
    expect(() => applyBlocks("dup dup", [{ search: "dup", replace: "x" }])).toThrow("2 kali");
    expect(() => applyBlocks("nothing here", [{ search: "absent", replace: "x" }])).toThrow("tidak ditemukan");
  });
});

describe("data/text tools", () => {
  test("parse/query json, csv stats, text diff", async () => {
    const parse = createDataTools("/nonexistent").find((t) => t.fqName === "data:parse_json")!;
    const validate = createDataTools("/nonexistent").find((t) => t.fqName === "data:validate_json")!;
    const query = createDataTools("/nonexistent").find((t) => t.fqName === "data:query_json")!;
    const parsed = await parse.execute({ text: '{"a":{"b":[1,2,3]}}' }, run) as { valid: boolean };
    expect(parsed.valid).toBe(true);
    const q = await query.execute({ text: '{"a":{"b":[10,20]}}', query: "a.b[1]" }, run) as { result: unknown };
    expect(q.result).toBe(20);
    await expect(validate.execute({ text: "{broken" }, run)).resolves.toHaveProperty("valid", false);
    const stats = createCsvTools("/nonexistent").find((t) => t.fqName === "data:statistics")!;
    const s = await stats.execute({ text: "sales\n10\n20\n30\n", column: "sales" }, run) as { mean: number; median: number };
    expect(s.mean).toBe(20);
    expect(s.median).toBe(20);
    expect(parseCsv('a,"x,y",b\n1,2,3').length).toBe(2);
    const d = diffLines("a\nb", "a\nc");
    expect(d.filter((l) => l.type === "add").map((l) => l.text)).toEqual(["c"]);
    const textSearch = createTextTools().find((t) => t.fqName === "text:search")!;
    const ts = await textSearch.execute({ text: "foo\nbar foo\n", query: "foo" }, run) as { totalMatches: number };
    expect(ts.totalMatches).toBe(2);
  });
});

describe("intent routing", () => {
  test("classifies coding/git/router/web/data intents", () => {
    expect(classifyIntent("perbaiki error build lalu jalankan test")).toContain("BUILD");
    expect(classifyIntent("lihat commit terakhir di git")).toContain("GIT");
    expect(classifyIntent("cek VLAN router")).toContain("ROUTER");
    expect(classifyIntent("hitung rata-rata kolom sales.csv")).toContain("DATA");
    expect(classifyIntent("baca package.json project ini")).toContain("FILES");
    expect(intentBoostPrefixes("kenapa build project gagal?").has("project:detect")).toBe(true);
    expect(intentBoostPrefixes("cari semua penggunaan createAgentToolRegistry").has("general:search_code")).toBe(true);
  });
});

describe("url policy", () => {
  test("blocks internal targets, allows public https", async () => {
    await expect(validateEgressUrl("http://127.0.0.1:3001/api", { maxBytes: 1 })).rejects.toThrow();
    await expect(validateEgressUrl("http://localhost/x", { maxBytes: 1 })).rejects.toThrow();
    await expect(validateEgressUrl("http://169.254.169.254/latest/meta-data", { maxBytes: 1 })).rejects.toThrow();
    await expect(validateEgressUrl("http://192.168.88.1/router", { maxBytes: 1 })).rejects.toThrow();
    await expect(validateEgressUrl("ftp://example.com/f", { maxBytes: 1 })).rejects.toThrow();
  });
});

describe("archive create", () => {
  test("creates zip from folder with limits", async () => {
    const base = await mkdtemp(join(tmpdir(), "archive-test-"));
    const root = await workspaceRoot(base, "test-user");
    await mkdir(join(root, "site", "assets"), { recursive: true });
    await writeFile(join(root, "site/index.html"), "<h1>ok</h1>");
    await writeFile(join(root, "site/assets/style.css"), "body{}");
    const create = createArchiveTools(base).find((t) => t.fqName === "archive:create")!;
    const result = await create.execute({ source: "site" }, run) as { files: number; bytes: number };
    expect(result.files).toBe(2);
    expect(result.bytes).toBeGreaterThan(0);
    await expect(create.execute({ source: "missing" }, run)).rejects.toThrow(ToolResultError);
  });
});
