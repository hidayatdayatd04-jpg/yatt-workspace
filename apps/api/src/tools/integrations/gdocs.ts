import { z } from "zod";
import type { IntegrationService } from "../../services/integrations";
import { defineTool, objectSchema, stringField } from "../types";
import { googleRequest } from "./http";

/** Google Docs API (docs.googleapis.com/v1) — login akun Google Docs tersendiri. */
export function createGDocsTools(service: IntegrationService) {
  return [
    defineTool({ name: "gdocs:create_document", connector: "docs", permission: "write", description: "Buat Google Docs baru (opsional isi paragraf awal). Mengembalikan documentId + link. Menggunakan login akun Google Docs sendiri.", schema: z.object({ title: z.string().min(1).max(300), paragraphs: z.array(z.string().max(20_000)).max(100).default([]) }).strict(), parameters: objectSchema({ title: stringField, paragraphs: { type: "array" } }, ["title"]),
      execute: async (args, run, signal) => {
        const created = await googleRequest(service, run.userId, "docs", "/v1/documents", { title: args.title }, signal) as { documentId?: unknown; title?: unknown; body?: { content?: Array<{ endIndex?: unknown }> } };
        const docId = String(created.documentId ?? "");
        if (docId && args.paragraphs.length > 0) {
          const end = Number(created.body?.content?.at(-1)?.endIndex ?? 1);
          await googleRequest(service, run.userId, "docs", `/v1/documents/${encodeURIComponent(docId)}:batchUpdate`, { requests: [{ insertText: { endIndex: Math.max(1, end - 1), text: args.paragraphs.join("\n") } }] }, signal);
        }
        return { documentId: docId, title: String(created.title ?? args.title), url: `https://docs.google.com/document/d/${docId}/edit` };
      } }),
    defineTool({ name: "gdocs:append_document_text", connector: "docs", permission: "write", description: "Tambahkan teks di akhir Google Docs existing (documentId). Baca isi via drive:read_document dulu bila perlu konteks.", schema: z.object({ documentId: z.string().min(1).max(256), text: z.string().min(1).max(50_000) }).strict(), parameters: objectSchema({ documentId: stringField, text: stringField }, ["documentId", "text"]),
      execute: async (args, run, signal) => {
        const doc = await googleRequest(service, run.userId, "docs", `/v1/documents/${encodeURIComponent(args.documentId)}?fields=documentId,body.content.endIndex`, undefined, signal) as { body?: { content?: Array<{ endIndex?: unknown }> } };
        const end = Number(doc.body?.content?.at(-1)?.endIndex ?? 1);
        await googleRequest(service, run.userId, "docs", `/v1/documents/${encodeURIComponent(args.documentId)}:batchUpdate`, { requests: [{ insertText: { endIndex: Math.max(1, end - 1), text: args.text } }] }, signal);
        return { documentId: args.documentId, appendedChars: args.text.length };
      } }),
  ];
}
