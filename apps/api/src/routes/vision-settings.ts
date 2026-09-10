import { supportsVision } from "@shared/index";
import { fetchProviderModels } from "../agent/model-fetch";
import { FetchModelsSchema } from "./ai-provider/ctx";
import { AppError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { requireWorkspace } from "../middleware/session";
import { PROVIDER_KINDS } from "../agent/provider-settings-types";
import type { VisionSettingsService } from "../agent/vision-settings";

/**
 * Vision providers (multi-provider, mirip ai-provider): daftar provider yang
 * tiap provider menyimpan daftar models + activeModel berurutan untuk
 * fallback otomatis saat baca gambar (model 1 error/limit → berikutnya).
 * API key tidak pernah dikembalikan plaintext; bila dikosongkan saat save,
 * kunci tersimpan dipakai ulang.
 */
export function createVisionSettingsRoutes(deps: { settings: VisionSettingsService; logger: Logger }) {
  const routes = new Hono<Env>();

  routes.get("/", async (c) => {
    const workspace = requireWorkspace(c);
    const providers = await deps.settings.list(workspace.userId);
    return c.json({ providers });
  });

  routes.get("/:id", async (c) => {
    const workspace = requireWorkspace(c);
    const provider = await deps.settings.get(workspace.userId, c.req.param("id"));
    if (!provider) return c.json({ error: { code: "NOT_FOUND", message: "Provider vision tidak ditemukan." } }, 404);
    return c.json({ provider });
  });

  const modelList = z.array(z.string().min(1).max(255)).min(1).max(50);
  const SaveSchema = z.object({
    id: z.string().max(64).optional(),
    kind: z.enum(PROVIDER_KINDS),
    name: z.string().max(128).optional(),
    baseUrl: z.string().max(512).optional(),
    apiKey: z.string().min(8).max(512).optional(),
    models: modelList.optional(),
    activeModel: z.string().min(1).max(255).optional(),
    model: z.string().min(1).max(255).optional(),
    enabled: z.boolean().optional(),
  });
  routes.post("/", zValidator("json", SaveSchema), async (c) => {
    const workspace = requireWorkspace(c);
    const provider = await deps.settings.save(workspace.userId, c.req.valid("json"));
    return c.json({ provider });
  });

  const ToggleSchema = z.object({ enabled: z.boolean() });
  routes.patch("/:id/toggle", zValidator("json", ToggleSchema), async (c) => {
    const workspace = requireWorkspace(c);
    const provider = await deps.settings.toggle(workspace.userId, c.req.param("id"), c.req.valid("json").enabled);
    return c.json({ provider });
  });

  const ActiveModelSchema = z.object({ model: z.string().min(1).max(255) });
  routes.patch("/:id/active-model", zValidator("json", ActiveModelSchema), async (c) => {
    const workspace = requireWorkspace(c);
    const provider = await deps.settings.setActiveModel(workspace.userId, c.req.param("id"), c.req.valid("json").model);
    return c.json({ provider });
  });

  routes.delete("/:id", async (c) => {
    const workspace = requireWorkspace(c);
    await deps.settings.remove(workspace.userId, c.req.param("id"));
    return c.json({ ok: true });
  });

  routes.delete("/", async (c) => {
    const workspace = requireWorkspace(c);
    await deps.settings.remove(workspace.userId);
    return c.json({ ok: true });
  });

  routes.post("/models", zValidator("json", FetchModelsSchema), async (c) => {
    const workspace = requireWorkspace(c);
    const input = c.req.valid("json");
    const saved = !input.apiKey && input.providerId
      ? await deps.settings.getSavedKey(workspace.userId, input.providerId)
      : null;
    if (!input.apiKey && !saved) throw new AppError("VALIDATION_FAILED", "API key atau provider tersimpan wajib dipilih.", 422);
    if (saved && (saved.kind !== input.kind || (input.baseUrl && input.baseUrl.replace(/\/+$/, "") !== saved.baseUrl))) {
      throw new AppError("VALIDATION_FAILED", "Untuk endpoint baru, isi ulang API key sebelum mengambil model.", 422);
    }
    const result = await fetchProviderModels({
      kind: input.kind,
      baseUrl: input.baseUrl ?? saved?.baseUrl,
      apiKey: input.apiKey ?? saved!.apiKey,
      logger: deps.logger,
    });
    return c.json({ models: result.models.filter((model) => supportsVision(model.id)), source: result.source });
  });

  return routes;
}
