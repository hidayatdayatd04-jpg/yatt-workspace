import { z } from "zod";
import type { IntegrationService } from "../../services/integrations";
import { defineTool, objectSchema, stringField } from "../types";
import { googleRequest } from "./http";

/** Google Slides API (slides.googleapis.com/v1) — login akun Google Slides tersendiri. */
export function createGSlidesTools(service: IntegrationService) {
  const slides = (userId: string, path: string, body?: unknown, signal?: AbortSignal, init?: { method?: string }) =>
    googleRequest(service, userId, "slides", path, body, signal, init);
  return [
    defineTool({ name: "slides:create_presentation", connector: "slides", permission: "write", description: "Buat Google Slides baru dengan judul. Slide isi ditambah via slides:add_slide. Mengembalikan presentationId + link. Menggunakan login akun Google Slides sendiri.", schema: z.object({ title: z.string().min(1).max(300) }).strict(), parameters: objectSchema({ title: stringField }, ["title"]),
      execute: async (args, run, signal) => {
        const created = await slides(run.userId, "/v1/presentations", { title: args.title }, signal) as { presentationId?: unknown; title?: unknown };
        const id = String(created.presentationId ?? "");
        return { presentationId: id, title: String(created.title ?? args.title), url: `https://docs.google.com/presentation/d/${id}/edit` };
      } }),
    defineTool({ name: "slides:read_slides", connector: "slides", description: "Baca struktur Google Slides: daftar slide + teks yang ada di tiap slide (title/body).", schema: z.object({ presentationId: z.string().min(1).max(256) }).strict(), parameters: objectSchema({ presentationId: stringField }, ["presentationId"]),
      execute: async (args, run, signal) => {
        const deck = await slides(run.userId, `/v1/presentations/${encodeURIComponent(args.presentationId)}?fields=presentationId,title,slides(objectId,slideProperties.title,body.text.elements.textRun.content)`, undefined, signal) as { presentationId?: unknown; title?: unknown; slides?: Array<{ objectId?: unknown }> };
        const out = { presentationId: String(deck.presentationId ?? args.presentationId), title: String((deck as { title?: unknown }).title ?? ""), slides: (deck.slides ?? []).map((s, i) => ({ index: i + 1, objectId: String(s.objectId ?? "") })) };
        return out;
      } }),
    defineTool({ name: "slides:add_slide", connector: "slides", permission: "write", description: "Tambah slide baru (title-and-body atau title-only) ke Google Slides existing, dengan judul + teks body opsional.", schema: z.object({ presentationId: z.string().min(1).max(256), title: z.string().max(300).optional(), body: z.string().max(10_000).optional(), layout: z.enum(["title_and_body", "title_only"]).default("title_and_body") }).strict(), parameters: objectSchema({ presentationId: stringField, title: stringField, body: stringField, layout: stringField }, ["presentationId"]),
      execute: async (args, run, signal) => {
        const slideId = `slide_${crypto.randomUUID().slice(0, 8)}`;
        const requests: unknown[] = [{ createSlide: { objectId: slideId, slideLayoutReference: { predefinedLayout: args.layout === "title_only" ? "TITLE_ONLY" : "TITLE_AND_BODY" } } }];
        if (args.title) requests.push({ insertText: { objectId: slideId, text: args.title, insertionIndex: 0 } });
        if (args.body) requests.push({ insertText: { objectId: slideId, text: args.body, insertionIndex: 0 } });
        await slides(run.userId, `/v1/presentations/${encodeURIComponent(args.presentationId)}:batchUpdate`, { requests }, signal);
        return { presentationId: args.presentationId, slideId };
      } }),
  ];
}
