import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createDb } from "../db";
import { workspaces } from "../db/schema";
import { createLogger } from "../lib/logger";
import { LOCAL_WORKSPACE_ID } from "../lib/workspace";
import { AppError } from "../lib/errors";
import type { Env } from "../types";
import { createVisionSettingsRoutes } from "../routes/vision-settings";
import { createVisionSettingsService } from "./vision-settings";
import { buildModels } from "./vision-settings-utils";
import { supportsVision } from "@shared/index";

const databases: ReturnType<typeof createDb>[] = [];
const logger = createLogger("error");
function fixture() {
  const db = createDb();
  databases.push(db);
  const service = createVisionSettingsService({ db, logger,
    keyRing: { currentVersion: 1, resolve: () => Buffer.alloc(32, 7) } });
  return { db, service };
}
const user = LOCAL_WORKSPACE_ID;
const input = { kind: "custom" as const, baseUrl: "https://example.com/v1", apiKey: "private-key-value",
  models: ["gpt-4o-mini", "gpt-4o"], activeModel: "gpt-4o" };
afterEach(() => { for (const db of databases.splice(0)) db.$client.close(); });

describe("Vision settings", () => {
  test("rejects text-only and unknown models, including active model", () => {
    for (const model of ["deepseek-chat", "gpt-3.5-turbo", "llama3.2:latest", "unknown-model", "o3-mini"]) {
      expect(supportsVision(model)).toBe(false);
      expect(() => buildModels({ models: ["gpt-4o"], activeModel: model })).toThrow(model);
    }
    for (const model of ["gpt-4o-mini", "google/gemini-2.0-flash-001", "anthropic/claude-3.5-sonnet", "qwen2.5-vl:latest"]) {
      expect(supportsVision(model)).toBe(true);
    }
  });
  test("encrypts keys, retains blank key, isolates owners and orders active models", async () => {
    const { db, service } = fixture();
    const saved = await service.save(user, input);
    expect(JSON.stringify(saved)).not.toContain(input.apiKey);
    const row = db.$client.query("SELECT api_key_ciphertext FROM vision_providers").get();
    expect(JSON.stringify(row)).not.toContain(input.apiKey);
    await service.save(user, { ...input, id: saved.id, apiKey: undefined });
    expect((await service.getSavedKey(user, saved.id))?.apiKey).toBe(input.apiKey);
    expect((await service.listVisionCandidates(user)).map((c) => c.model)).toEqual(["gpt-4o", "gpt-4o-mini"]);
    await service.setActiveModel(user, saved.id, "gpt-4o-mini");
    expect((await service.listVisionCandidates(user))[0]?.model).toBe("gpt-4o-mini");
    await expect(service.setActiveModel(user, saved.id, "gemini-2.0-flash")).rejects.toThrow("belum terdaftar");
    await db.insert(workspaces).values({ id: "other", name: "Other" });
    expect(await service.get("other", saved.id)).toBeNull();
    expect(await service.getSavedKey("other", saved.id)).toBeNull();
    await expect(service.save("other", { ...input, id: saved.id })).rejects.toThrow("tidak ditemukan");
    await service.remove("other", saved.id);
    expect(await service.get(user, saved.id)).not.toBeNull();
    await expect(service.save(user, { ...input, id: saved.id, apiKey: undefined, baseUrl: "https://other.test/v1" })).rejects.toThrow("endpoint");
    await service.toggle(user, saved.id, false);
    expect(await service.listVisionCandidates(user)).toEqual([]);
    await service.remove(user, saved.id);
    expect(await service.list(user)).toEqual([]);
  });
  test("tries multiple providers even with the same model name", async () => {
    const { service } = fixture();
    await service.save(user, { ...input, id: "first", models: ["gpt-4o"], activeModel: "gpt-4o" });
    await service.save(user, { ...input, id: "second", models: ["gpt-4o"], activeModel: "gpt-4o", apiKey: "different-key" });
    expect((await service.listVisionCandidates(user)).map((c) => c.providerId)).toEqual(["first", "second"]);
  });
  test("model endpoint filters models and restricts reuse of saved credentials", async () => {
    const { service } = fixture();
    let requests = 0;
    const server = Bun.serve({ port: 0, fetch(req) {
      requests++;
      expect(req.headers.get("authorization")).toBe(`Bearer ${input.apiKey}`);
      return Response.json({ data: [{ id: "gpt-4o" }, { id: "deepseek-chat" }, { id: "unknown-model" }] });
    } });
    try {
      const saved = await service.save(user, { ...input, baseUrl: `http://127.0.0.1:${server.port}/v1` });
      const app = new Hono<Env>();
      app.use("*", async (c, next) => { c.set("workspace", { userId: user }); await next(); });
      app.onError((err) => Response.json({ error: err.message }, { status: err instanceof AppError ? err.status : 500 }));
      app.route("/", createVisionSettingsRoutes({ settings: service, logger }));
      const fetchModels = (body: object) => app.request("/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const res = await fetchModels({ providerId: saved.id, kind: "custom" });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { models: { id: string }[] }).models).toEqual([{ id: "gpt-4o" }]);
      expect((await fetchModels({ providerId: saved.id, kind: "custom", baseUrl: "https://other.test" })).status).toBe(422);
      expect((await fetchModels({ providerId: "missing", kind: "custom" })).status).toBe(422);
      expect(requests).toBe(1);
      const list = await (await app.request("/")).text();
      expect(list).not.toContain(input.apiKey);
    } finally { server.stop(true); }
  });
});
