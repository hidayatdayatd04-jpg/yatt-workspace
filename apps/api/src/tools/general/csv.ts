import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";

const pathSchema = z.string().min(1).max(1000);

/** Parse CSV (RFC4180 longgar: quote, koma, newline dalam sel). */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const delim = delimiter.charCodeAt(0);
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (inQuotes) {
      if (ch === 34) {
        if (text.charCodeAt(i + 1) === 34) { cell += '"'; i++; } else inQuotes = false;
      } else cell += text[i]!;
      continue;
    }
    if (ch === 34) { inQuotes = true; continue; }
    if (ch === delim) { row.push(cell); cell = ""; continue; }
    if (ch === 10) { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (ch === 13) continue;
    cell += text[i]!;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function csvFromWorkspace(baseDir: string, userId: string, path: string): Promise<string> {
  return (async () => {
    const file = await workspacePath(await workspaceRoot(baseDir, userId), path);
    const bytes = await readFile(file).catch(() => null);
    if (bytes === null) throw new ToolResultError("FILE_NOT_FOUND", `File ${path} tidak ditemukan.`);
    if (bytes.length > 5_000_000) throw new ToolResultError("VALIDATION_FAILED", "CSV maksimal 5 MB.");
    return bytes.toString("utf8");
  })();
}

/** Statistik deskriptif kolom numerik: count/sum/mean/min/max. */
function stats(values: number[]): Record<string, number> {
  const n = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const sorted = [...values].sort((a, b) => a - b);
  return { count: n, sum, mean: n ? sum / n : 0, min: sorted[0] ?? 0, max: sorted[n - 1] ?? 0, median: n ? sorted[Math.floor((n - 1) / 2)]! : 0 };
}

const number = (v: unknown) => typeof v === "number" && Number.isFinite(v);

export function createCsvTools(baseDir: string) {
  const common = { text: z.string().max(5_000_000).optional(), path: pathSchema.optional(), delimiter: z.string().min(1).max(1).default(",") };
  return [
    defineTool({ name: "data:inspect_csv", connector: "workspace", tags: ["data", "csv", "read"],
      description: "Inspeksi CSV: header, jumlah baris, inferensi tipe kolom, sampel 3 baris pertama.",
      schema: z.object({ ...common }).strict(),
      parameters: objectSchema({ text: stringField, path: stringField, delimiter: stringField }),
      execute: async (args, run) => {
        const raw = args.text ?? await csvFromWorkspace(baseDir, run.userId, args.path ?? "");
        const rows = parseCsv(raw, args.delimiter);
        if (rows.length === 0) throw new ToolResultError("VALIDATION_FAILED", "CSV kosong.");
        const header = rows[0]!;
        const body = rows.slice(1);
        const columns = header.map((name, i) => {
          const numeric = body.filter((r) => r[i] !== undefined && r[i] !== "" && !Number.isNaN(Number(r[i]))).length;
          return { column: name || `col${i + 1}`, numericRatio: body.length ? numeric / body.length : 0 };
        });
        return { header, rows: body.length, columns, sample: body.slice(0, 3) };
      } }),
    defineTool({ name: "data:query_csv", connector: "workspace", tags: ["data", "csv", "query"],
      description: "Baca sebagian CSV (semua kolom atau columns terpilih) dengan offset/limit — hemat context untuk file besar.",
      schema: z.object({ ...common, columns: z.array(z.string().max(200)).max(50).optional(), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(500).default(50) }).strict(),
      parameters: objectSchema({ text: stringField, path: stringField, delimiter: stringField, columns: { type: "array", items: stringField }, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 500 } }),
      execute: async (args, run) => {
        const raw = args.text ?? await csvFromWorkspace(baseDir, run.userId, args.path ?? "");
        const rows = parseCsv(raw, args.delimiter);
        const header = rows[0] ?? [];
        const wanted = args.columns?.map((c) => header.indexOf(c)).filter((i) => i >= 0) ?? header.map((_, i) => i);
        const body = rows.slice(1 + args.offset, 1 + args.offset + args.limit).map((r) => wanted.map((i) => r[i] ?? ""));
        return { header: wanted.map((i) => header[i]!), rows: body, totalRows: rows.length - 1, nextOffset: 1 + args.offset + args.limit < rows.length ? args.offset + args.limit : null };
      } }),
    defineTool({ name: "data:statistics", connector: "workspace", tags: ["data", "csv", "stats", "compute"],
      description: "Statistik deskriptif kolom CSV/inline: count, sum, mean, min, max, median. Untuk analisis kompleks gunakan compute:execute_python.",
      schema: z.object({ ...common, column: z.string().max(200) }).strict(),
      parameters: objectSchema({ text: stringField, path: stringField, delimiter: stringField, column: stringField }, ["column"]),
      execute: async (args, run) => {
        const raw = args.text ?? await csvFromWorkspace(baseDir, run.userId, args.path ?? "");
        const rows = parseCsv(raw, args.delimiter);
        const header = rows[0] ?? [];
        const idx = header.indexOf(args.column);
        if (idx < 0) throw new ToolResultError("VALIDATION_FAILED", `Kolom "${args.column}" tidak ada. Tersedia: ${header.join(", ")}`);
        const values = rows.slice(1).map((r) => Number(r[idx])).filter(number);
        if (values.length === 0) throw new ToolResultError("VALIDATION_FAILED", `Kolom "${args.column}" tidak berisi angka.`);
        return { column: args.column, ...stats(values) };
      } }),
  ];
}
