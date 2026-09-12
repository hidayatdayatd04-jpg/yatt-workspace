import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { officeTarget } from "./office-shared";

const pathSchema = z.string().min(1).max(1000);

/** Baca sheet Excel terstruktur (nilai per sel) — pelengkap general:read_file yang hanya memberi CSV. */
export function createOfficeReadTools(baseDir: string) {
  return [
    defineTool({ name: "office:read_sheet", connector: "workspace", description: "Baca nilai sel workbook Excel (.xlsx/.xls) secara terstruktur: daftar semua sheet atau isi satu sheet dalam rentang ala 'A1:F20'. Lebih presisi daripada general:read_file untuk spreadsheet; utamakan ini saat perlu nilai sel tertentu.", schema: z.object({ path: pathSchema, sheetName: z.string().min(1).max(200).optional(), range: z.string().regex(/^[A-Za-z0-9]+(?::[A-Za-z0-9]+)?$/).optional() }).strict(), parameters: objectSchema({ path: stringField, sheetName: stringField, range: stringField }, ["path"]),
      execute: async (args, run) => {
        const file = await officeTarget(baseDir, run.userId, args.path);
        const wb = XLSX.read(await readFile(file), { type: "buffer" });
        const sheetNames = wb.SheetNames;
        if (!args.sheetName) return { path: args.path, sheets: sheetNames };
        if (!sheetNames.includes(args.sheetName)) {
          throw new Error(`Sheet "${args.sheetName}" tidak ditemukan. Sheet tersedia: ${sheetNames.join(", ")}.`);
        }
        const sheet = wb.Sheets[args.sheetName]!;
        const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: args.range ?? void 0, raw: false });
        return { path: args.path, sheetName: args.sheetName, rows: values.slice(0, 500) };
      } }),
  ];
}
