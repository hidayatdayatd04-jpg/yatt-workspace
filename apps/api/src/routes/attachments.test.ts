import { afterEach, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { zipSync } from "fflate";
import { createDb, type Database } from "../db";
import { conversations, workspaces } from "../db/schema";
import { createStorageService } from "../services/storage";
import { detectContentKind } from "../services/file-extract";
import { createAttachmentRoutes } from "./attachments";
import { createAttachmentReadTools } from "../tools/general/attachment-read";
import { buildAttachmentContext, buildAttachmentNote } from "./chat/runs-attachments";
import type { StartRunInput } from "../agent/loop/types";
import type { Env } from "../types";
import { AppError } from "../lib/errors";
import { createLogger } from "../lib/logger";
const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.$client.close(); });
async function fixture() {
  const db = createDb(); databases.push(db);
  const userId = crypto.randomUUID(), other = crypto.randomUUID(), conversationId = crypto.randomUUID();
  await db.insert(workspaces).values([{ id: userId }, { id: other }]);
  await db.insert(conversations).values({ id: conversationId, userId });
  const storage = createStorageService({ directory: await mkdtemp(join(tmpdir(), "attachment-test-")) });
  const app = new Hono<Env>();
  app.use("*", async (c, next) => { c.set("workspace", { userId: c.req.header("x-user") ?? userId }); await next(); });
  app.onError((err) => Response.json({ error: err.message }, { status: err instanceof AppError ? err.status : 500 }));
  app.route("/", createAttachmentRoutes({ db, storage, logger: createLogger("error"), limits: { maxBytes: 10 * 1024 * 1024, maxFilesPerMessage: 4 } }));
  const upload = async (name: string, bytes: Uint8Array, type: string) => {
    const form = new FormData(); form.append("file", new File([new Uint8Array(bytes)], name, { type }));
    const response = await app.request(`/${conversationId}/files`, { method: "POST", body: form });
    expect(response.status).toBe(200);
    return ((await response.json()) as { attachment: { id: string; contentKind: string; contentType: string } }).attachment;
  };
  return { db, app, storage, userId, other, conversationId, upload };
}
test("JSON with charset uploads, downloads and reads through the chat reader without import", async () => {
  const f = await fixture();
  const json = Buffer.from('{"interfaces":["ether1","ether2"]}');
  const file = await f.upload("konfigurasi.json", json, "application/json;charset=utf-8");
  expect(file.contentKind).toBe("text");
  const content = await f.app.request(`/files/${file.id}/content`);
  expect(((await content.json()) as { content: string }).content).toBe(json.toString());
  const downloaded = await f.app.request(`/files/${file.id}`);
  expect(await downloaded.text()).toBe(json.toString());
  expect(downloaded.headers.get("x-content-type-options")).toBe("nosniff");
  for (const path of [`/files/${file.id}`, `/files/${file.id}/content`, `/${f.conversationId}/files`]) {
    expect((await f.app.request(path, { headers: { "x-user": f.other } })).status).toBe(404);
  }
  const tools = createAttachmentReadTools({ db: f.db, readObject: async (key) => (await f.storage.get(key)).body });
  const run = { userId: f.userId, conversationId: f.conversationId } as StartRunInput;
  const reader = tools.find((tool) => tool.fqName === "general:read_attachment")!;
  expect(reader.permission).toBe("read");
  expect(await reader.execute({ attachmentId: file.id }, run)).toMatchObject({ content: json.toString() });
  await expect(reader.execute({ attachmentId: file.id }, { ...run, conversationId: crypto.randomUUID() })).rejects.toThrow("percakapan ini");
  const list = await tools.find((tool) => tool.fqName === "general:list_attachments")!.execute({}, run) as { attachments: { attachmentId: string }[] };
  expect(list.attachments[0]?.attachmentId).toBe(file.id);
});
test("ZIP supports listing and targeted reads, images tolerate MIME aliases, unknown binary stays downloadable", async () => {
  const f = await fixture();
  const archive = await f.upload("folder (1).zip", zipSync({ "folder/file.json": Buffer.from('{"ok":true}'), "folder/SKILL.md": Buffer.from("Actual skill text") }), "application/x-zip-compressed");
  expect(archive.contentKind).toBe("archive");
  const content = await f.app.request(`/files/${archive.id}/content?entryPath=folder%2Ffile.json`);
  expect(((await content.json()) as { content: string }).content).toBe('{"ok":true}');
  const image = await f.upload("gambar.png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "application/octet-stream");
  expect(image.contentType).toBe("image/png");
  const binary = await f.upload("data.unknown", Buffer.from([0, 1, 2, 3]), "application/octet-stream");
  expect(binary.contentKind).toBe("unsupported");
  expect((await f.app.request(`/files/${binary.id}`)).status).toBe(200);
  const listed = (await (await f.app.request(`/${f.conversationId}/files`)).json()) as { attachments: { id: string }[] };
  expect(listed.attachments.length).toBe(3);
});
test("attachment context includes IDs, extraction failures and large images without silent omission", async () => {
  const f = await fixture();
  const file = await f.upload("broken.pdf", Buffer.from("%PDF-invalid"), "application/pdf");
  const image = await f.upload("image.png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png");
  const ctx = { deps: { db: f.db, loadAttachmentContent: async ({ attachmentId }: { attachmentId: string }) => {
    const name = attachmentId === file.id ? "broken.pdf" : "image.png";
    const bytes = attachmentId === file.id ? Buffer.from("%PDF-invalid") : Buffer.alloc(5 * 1024 * 1024);
    const kind = attachmentId === file.id ? detectContentKind({ head: bytes, originalName: name, mimeType: "application/pdf" }).kind : "image";
    return { kind, name, bytes, mime: attachmentId === file.id ? "application/pdf" : "image/png" };
  } } } satisfies Parameters<typeof buildAttachmentContext>[0];
  const result = await buildAttachmentContext(ctx, { userId: f.userId, conversationId: f.conversationId, wantedIds: [file.id, image.id] });
  const note = buildAttachmentNote(result.blocks);
  expect(note).toContain(`attachmentId=${file.id}`);
  expect(note).toContain("general:read_attachment");
  expect(note).toContain("Ekstraksi teks gagal");
  expect(result.visionImages.length).toBe(1);
});
