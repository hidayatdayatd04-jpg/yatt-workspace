import { z } from "zod";
import type { IntegrationService } from "../../services/integrations";
import { defineTool, objectSchema, stringField } from "../types";
import { ToolResultError } from "../errors";
import { googleRequest } from "./http";

/** Operasi file Google Drive: search/get/read/create + rename/copy/delete (write). */
export function createDriveFileTools(service: IntegrationService) {
  return [
    defineTool({ name: "drive:search_files", connector: "drive", description: "Cari file Google Drive menggunakan query Drive, misalnya name contains 'laporan'. Hasil mencakup ID, nama, tipe, dan link; gunakan pageToken untuk halaman berikutnya.", schema: z.object({ query: z.string().max(1000).default("trashed = false"), pageToken: z.string().max(2000).optional() }).strict(), parameters: objectSchema({ query: stringField, pageToken: stringField }),
      execute: (args, run, signal) => googleRequest(service, run.userId, "drive", `/drive/v3/files?${new URLSearchParams({ q: args.query, pageSize: "25", fields: "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)", ...(args.pageToken ? { pageToken: args.pageToken } : {}) })}`, undefined, signal) }),
    defineTool({ name: "drive:get_file", connector: "drive", description: "Baca metadata file Drive berdasarkan ID. Mengembalikan deskripsi, tipe, ukuran dan link.", schema: z.object({ fileId: z.string().min(1).max(256) }).strict(), parameters: objectSchema({ fileId: stringField }, ["fileId"]),
      execute: (args, run, signal) => googleRequest(service, run.userId, "drive", `/drive/v3/files/${encodeURIComponent(args.fileId)}?fields=id,name,mimeType,description,size,webViewLink`, undefined, signal) }),
    defineTool({ name: "drive:read_document", connector: "drive", description: "Baca isi Google Docs sebagai teks. Untuk file binary gunakan metadata; tool ini khusus dokumen Google.", schema: z.object({ fileId: z.string().min(1).max(256) }).strict(), parameters: objectSchema({ fileId: stringField }, ["fileId"]),
      execute: async (args, run, signal) => {
        const { googleRequest, googleToken } = await import("./http");
        const meta = await googleRequest(service, run.userId, "drive", `/drive/v3/files/${encodeURIComponent(args.fileId)}?fields=id,name,mimeType,webViewLink`, undefined, signal) as { name?: unknown; mimeType?: unknown; webViewLink?: unknown };
        const mimeType = String(meta.mimeType ?? "");
        if (mimeType && !mimeType.startsWith("application/vnd.google-apps.")) {
          const name = String(meta.name ?? args.fileId);
          throw new ToolResultError("TOOL_FAILED", `"${name}" adalah file binary (${mimeType}) — isinya tidak dapat dibaca sebagai teks dokumen.`, {
            guidance: `Batasan tool drive: hanya dokumen Google Docs yang bisa dibaca teksnya. Gunakan link file (${String(meta.webViewLink ?? "tidak tersedia")}) untuk unduhan manual, lampirkan file ke chat agar dianalisis, atau jelaskan batasan ini ke pengguna.`,
          });
        }
        const token = await googleToken(service, run.userId, "drive", signal);
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}/export?mimeType=text%2Fplain`, { redirect: "error", headers: { Authorization: `Bearer ${token}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
        if (!response.ok) { await response.body?.cancel(); throw new ToolResultError("TOOL_FAILED", `Tidak dapat membaca dokumen (HTTP ${response.status}).`, { guidance: "Dokumen mungkin besar atau berbagi dibatasi. Coba drive:get_file untuk metadata, atau jelaskan batasan pembacaan ke pengguna." }); }
        const reader = response.body!.getReader(); let text = ""; const decoder = new TextDecoder();
        try { while (text.length < 6500) { const { done, value } = await reader.read(); if (done) break; text += decoder.decode(value, { stream: true }); } } finally { await reader.cancel(); }
        return { text: text.slice(0, 6500), truncated: text.length >= 6500, name: String(meta.name ?? ""), mimeType, webViewLink: String(meta.webViewLink ?? "") };
      } }),
    defineTool({ name: "drive:create_text_file", connector: "drive", permission: "write", description: "Buat file teks baru di Google Drive. Memerlukan izin tulis connector.", schema: z.object({ name: z.string().min(1).max(200), text: z.string().max(100000), folderId: z.string().max(256).default("").optional() }).strict(), parameters: objectSchema({ name: stringField, text: stringField, folderId: stringField }, ["name", "text"]),
      execute: async (args, run, signal) => {
        const { googleToken, boundedJson } = await import("./http");
        const token = await googleToken(service, run.userId, "drive", signal);
        const boundary = `agent_${crypto.randomUUID()}`;
        const metadata = { name: args.name, mimeType: "text/plain", ...(args.folderId ? { parents: [args.folderId] } : {}) };
        return boundedJson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", { method: "POST", signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${args.text}\r\n--${boundary}--` });
      } }),
    defineTool({ name: "drive:rename_file", connector: "drive", permission: "write", description: "Ubah nama file/folder Google Drive berdasarkan ID.", schema: z.object({ fileId: z.string().min(1).max(256), name: z.string().min(1).max(200) }).strict(), parameters: objectSchema({ fileId: stringField, name: stringField }, ["fileId", "name"]),
      execute: (args, run, signal) => googleRequest(service, run.userId, "drive", `/drive/v3/files/${encodeURIComponent(args.fileId)}?fields=id,name,webViewLink`, { name: args.name }, signal, { method: "PATCH" }) }),
    defineTool({ name: "drive:copy_file", connector: "drive", permission: "write", description: "Salin file Google Drive menjadi file baru (nama baru opsional).", schema: z.object({ fileId: z.string().min(1).max(256), name: z.string().max(200).optional() }).strict(), parameters: objectSchema({ fileId: stringField, name: stringField }, ["fileId"]),
      execute: (args, run, signal) => googleRequest(service, run.userId, "drive", `/drive/v3/files/${encodeURIComponent(args.fileId)}/copies?fields=id,name,webViewLink`, args.name ? { name: args.name } : {}, signal) }),
    defineTool({ name: "drive:delete_file", connector: "drive", permission: "write", description: "Hapus file Google Drive. Default memindahkan ke trash (bisa dipulihkan). Hapus PERMANEN wajib confirm:'ya' dua lapis — tanpa itu tool menolak dan meminta konfirmasi pengguna di chat.", schema: z.object({ fileId: z.string().min(1).max(256), permanent: z.boolean().default(false), confirm: z.string().max(10).optional() }).strict(), parameters: objectSchema({ fileId: stringField, permanent: { type: "boolean" }, confirm: stringField }, ["fileId"]),
      execute: async (args, run, signal) => {
        if (args.permanent && args.confirm !== "ya") {
          throw new ToolResultError("USER_APPROVAL_REQUIRED", `Hapus permanen tidak dapat dijalankan tanpa konfirmasi pengguna.`, { guidance: `Tanyakan dulu ke pengguna di chat: "Yakin hapus PERMANEN file ini? Tindakan tidak bisa dibatalkan." Ulangi tool dengan confirm="ya" setelah pengguna menyetujui.` });
        }
        if (args.permanent) return googleRequest(service, run.userId, "drive", `/drive/v3/files/${encodeURIComponent(args.fileId)}`, undefined, signal, { method: "DELETE" });
        return googleRequest(service, run.userId, "drive", `/drive/v3/files/${encodeURIComponent(args.fileId)}?fields=id,name`, { trashed: true }, signal, { method: "PATCH" });
      } }),
  ];
}
