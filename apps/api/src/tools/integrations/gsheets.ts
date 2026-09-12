import { z } from "zod";
import type { IntegrationService } from "../../services/integrations";
import { defineTool, objectSchema, stringField } from "../types";
import { googleRequest } from "./http";

const rowsSchema = z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(5000);

/** Google Sheets API (sheets.googleapis.com/v4) — login akun Google Sheets tersendiri. */
export function createGSheetsTools(service: IntegrationService) {
  return [
    defineTool({ name: "sheets:create_spreadsheet", connector: "sheets", permission: "write", description: "Buat Google Sheets baru dengan judul + data awal (rows array-of-arrays mulai A1). Mengembalikan spreadsheetId + link. Menggunakan login akun Google Sheets sendiri.", schema: z.object({ title: z.string().min(1).max(300), rows: rowsSchema.default([]) }).strict(), parameters: objectSchema({ title: stringField, rows: { type: "array" } }, ["title"]),
      execute: async (args, run, signal) => {
        const created = await googleRequest(service, run.userId, "sheets", "/v4/spreadsheets", { properties: { title: args.title } }, signal) as { spreadsheetId?: unknown; properties?: { title?: unknown } };
        const id = String(created.spreadsheetId ?? "");
        if (id && args.rows.length > 0) {
          await googleRequest(service, run.userId, "sheets", `/v4/spreadsheets/${encodeURIComponent(id)}/values/A1:append?valueInputOption=USER_ENTERED`, { values: args.rows }, signal);
        }
        return { spreadsheetId: id, title: String(created.properties?.title ?? args.title), url: `https://docs.google.com/spreadsheets/d/${id}/edit` };
      } }),
    defineTool({ name: "sheets:read_sheet", connector: "sheets", description: "Baca nilai Google Sheets berdasarkan spreadsheetId: daftar semua sheet (tanpa range) atau isi satu range ala 'Sheet1!A1:F20'.", schema: z.object({ spreadsheetId: z.string().min(1).max(256), range: z.string().min(1).max(500).optional() }).strict(), parameters: objectSchema({ spreadsheetId: stringField, range: stringField }, ["spreadsheetId"]),
      execute: (args, run, signal) => args.range
        ? googleRequest(service, run.userId, "sheets", `/v4/spreadsheets/${encodeURIComponent(args.spreadsheetId)}/values/${encodeURIComponent(args.range)}`, undefined, signal)
        : googleRequest(service, run.userId, "sheets", `/v4/spreadsheets/${encodeURIComponent(args.spreadsheetId)}?fields=properties.title,sheets.properties.title`, undefined, signal) }),
    defineTool({ name: "sheets:write_sheet", connector: "sheets", permission: "write", description: "Tulis nilai ke Google Sheets: timpa mulai range ala 'Sheet1!A1' (append:false) atau tambah baris di bawah data terakhir (append:true). Nilai dikirim USER_ENTERED.", schema: z.object({ spreadsheetId: z.string().min(1).max(256), range: z.string().min(1).max(500), rows: rowsSchema.min(1), append: z.boolean().default(false) }).strict(), parameters: objectSchema({ spreadsheetId: stringField, range: stringField, rows: { type: "array" }, append: { type: "boolean" } }, ["spreadsheetId", "range", "rows"]),
      execute: (args, run, signal) => googleRequest(service, run.userId, "sheets", `/v4/spreadsheets/${encodeURIComponent(args.spreadsheetId)}/values/${encodeURIComponent(args.range)}:${args.append ? "append" : ""}?valueInputOption=USER_ENTERED`, { values: args.rows }, signal) }),
  ];
}
