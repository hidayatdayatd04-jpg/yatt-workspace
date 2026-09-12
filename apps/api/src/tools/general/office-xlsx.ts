import * as XLSX from "xlsx";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { officeTarget, readForEdit, writeEdited } from "./office-shared";

const pathSchema = z.string().min(1).max(1000);
const rowsSchema = z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(5000);
const cellSchema = z.tuple([z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/), z.union([z.string(), z.number(), z.boolean(), z.null()])]);

/** CRUD Excel lokal: create workbook baru + edit roundtrip (set sel, tambah/hapus sheet). */
export function createOfficeXlsxTools(baseDir: string) {
  return [
    defineTool({ name: "office:create_xlsx", connector: "workspace", permission: "write", description: "Buat workbook Excel (.xlsx) baru di workspace: sheet bernama, baris array-of-arrays (string/number/boolean/null), lebar kolom opsional. Menimpa bila path sudah ada — gunakan office:edit_xlsx untuk file existing.", schema: z.object({ path: pathSchema, sheetName: z.string().min(1).max(200).default("Sheet1"), rows: rowsSchema, columnWidths: z.array(z.number().min(0).max(255)).optional() }).strict(), parameters: objectSchema({ path: stringField, sheetName: stringField, rows: { type: "array" }, columnWidths: { type: "array" } }, ["path", "rows"]),
      execute: async (args, run) => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(args.rows), args.sheetName);
        if (args.columnWidths) wb.Sheets[args.sheetName]!["!cols"] = args.columnWidths.map((wch) => ({ wch }));
        const bytes = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
        const file = await officeTarget(baseDir, run.userId, args.path);
        return writeEdited(file, args.path, bytes);
      } }),
    defineTool({ name: "office:edit_xlsx", connector: "workspace", permission: "write", description: "Edit workbook Excel (.xlsx) existing: set nilai sel (alamat ala 'B2'), tulis baris mulai baris tertentu, tambah sheet baru, atau hapus sheet. Proteksi tumpang-tindih: expectedHash (sha256 dari office:read_sheet/read_file).", schema: z.object({ path: pathSchema, expectedHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), setCells: z.array(cellSchema).max(1000).default([]), appendRows: z.object({ sheetName: z.string().min(1).max(200).optional(), rows: rowsSchema }).optional(), addSheet: z.object({ name: z.string().min(1).max(200), rows: rowsSchema.default([]) }).optional(), deleteSheet: z.string().min(1).max(200).optional() }).strict(), parameters: objectSchema({ path: stringField, expectedHash: stringField, setCells: { type: "array" }, appendRows: { type: "object" }, addSheet: { type: "object" }, deleteSheet: stringField }, ["path"]),
      execute: async (args, run) => {
        const file = await officeTarget(baseDir, run.userId, args.path);
        const { bytes } = await readForEdit(file, args.expectedHash);
        const wb = XLSX.read(bytes, { type: "buffer", cellStyles: true });
        const active = args.appendRows?.sheetName ?? wb.SheetNames[0];
        if (args.deleteSheet) {
          if (!wb.SheetNames.includes(args.deleteSheet)) throw new Error(`Sheet "${args.deleteSheet}" tidak ditemukan.`);
          if (wb.SheetNames.length === 1) throw new Error("Workbook tidak boleh kosong — satu-satunya sheet tidak bisa dihapus.");
          wb.SheetNames = wb.SheetNames.filter((n) => n !== args.deleteSheet);
          delete wb.Sheets[args.deleteSheet];
        }
        if (args.addSheet) {
          const name = wb.SheetNames.includes(args.addSheet.name) ? `${args.addSheet.name} (${wb.SheetNames.length + 1})` : args.addSheet.name;
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(args.addSheet.rows), name);
        }
        if (active && !wb.Sheets[active]) throw new Error(`Sheet "${active}" tidak ditemukan. Sheet tersedia: ${wb.SheetNames.join(", ")}.`);
        if (active && args.setCells.length > 0) {
          const sheet = wb.Sheets[active]!;
          for (const [address, value] of args.setCells) sheet[address] = { t: value === null ? "z" : typeof value === "number" ? "n" : typeof value === "boolean" ? "b" : "s", v: value === null ? undefined : value };
        }
        if (active && args.appendRows && args.appendRows.rows.length > 0) XLSX.utils.sheet_add_aoa(wb.Sheets[active]!, args.appendRows.rows, { origin: -1 });
        const out = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
        return writeEdited(file, args.path, out);
      } }),
  ];
}
