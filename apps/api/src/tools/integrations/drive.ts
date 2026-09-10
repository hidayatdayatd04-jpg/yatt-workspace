import { z } from "zod";
import type { IntegrationService } from "../../services/integrations";
import { defineTool, objectSchema, stringField } from "../types";
import { googleRequest } from "./http";

export function createDriveTools(service: IntegrationService) {
  return [
    defineTool({ name: "drive:search_files", connector: "drive", description: "Cari file Google Drive menggunakan query Drive, misalnya name contains 'laporan'. Hasil mencakup ID, nama, tipe, dan link; gunakan pageToken untuk halaman selanjutnya.", schema: z.object({ query: z.string().max(1000).default("trashed = false"), pageToken: z.string().max(2000).optional() }).strict(), parameters: objectSchema({ query: stringField, pageToken: stringField }),
      execute: (args, run, signal) => googleRequest(service, run.userId, "drive", `/drive/v3/files?${new URLSearchParams({ q: args.query, pageSize: "25", fields: "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)", ...(args.pageToken ? { pageToken: args.pageToken } : {}) })}`, undefined, signal) }),
    defineTool({ name: "drive:get_file", connector: "drive", description: "Baca metadata file Drive berdasarkan ID. Mengembalikan deskripsi, tipe, ukuran dan link.", schema: z.object({ fileId: z.string().min(1).max(256) }).strict(), parameters: objectSchema({ fileId: stringField }, ["fileId"]),
      execute: (args, run, signal) => googleRequest(service, run.userId, "drive", `/drive/v3/files/${encodeURIComponent(args.fileId)}?fields=id,name,mimeType,description,size,webViewLink`, undefined, signal) }),
    defineTool({ name: "drive:read_document", connector: "drive", description: "Baca isi Google Docs sebagai teks. Untuk file binary gunakan metadata; tool ini khusus dokumen Google.", schema: z.object({ fileId: z.string().min(1).max(256) }).strict(), parameters: objectSchema({ fileId: stringField }, ["fileId"]),
      execute: async (args, run, signal) => {
        const { googleToken } = await import("./http");
        const token = await googleToken(service, run.userId, "drive", signal);
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}/export?mimeType=text%2Fplain`, { redirect: "error", headers: { Authorization: `Bearer ${token}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
        if (!response.ok) { await response.body?.cancel(); throw new Error(`Tidak dapat membaca dokumen (HTTP ${response.status}).`); }
        const reader = response.body!.getReader(); let text = ""; const decoder = new TextDecoder();
        try { while (text.length < 6500) { const { done, value } = await reader.read(); if (done) break; text += decoder.decode(value, { stream: true }); } } finally { await reader.cancel(); }
        return { text: text.slice(0, 6500), truncated: text.length >= 6500 };
      } }),
    defineTool({ name: "drive:create_text_file", connector: "drive", permission: "write", description: "Buat file teks baru di Google Drive. Memerlukan izin tulis connector.", schema: z.object({ name: z.string().min(1).max(200), text: z.string().max(100000), folderId: z.string().max(256).optional() }).strict(), parameters: objectSchema({ name: stringField, text: stringField, folderId: stringField }, ["name", "text"]),
      execute: async (args, run, signal) => {
        const { googleToken, boundedJson } = await import("./http");
        const token = await googleToken(service, run.userId, "drive", signal);
        const boundary = `agent_${crypto.randomUUID()}`;
        const metadata = { name: args.name, mimeType: "text/plain", ...(args.folderId ? { parents: [args.folderId] } : {}) };
        return boundedJson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", { method: "POST", signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${args.text}\r\n--${boundary}--` });
      } }),
  ];
}
