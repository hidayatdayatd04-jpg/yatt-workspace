import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { requireWorkspace } from "../middleware/session";
import { PROVIDER_KINDS } from "../agent/provider-settings-types";
import type { VisionSettingsService } from "../agent/vision-settings";

/**
 * Vision provider settings: GET status / PUT simpan / DELETE hapus.
 * API key tidak pernah dikembalikan dalam bentuk plaintext; bila dikosongkan
 * saat PUT, kunci yang tersimpan dipakai ulang.
 */
export function createVisionSettingsRoutes(deps: { settings: VisionSettingsService }) {
  const routes = new Hono<Env>();

  routes.get("/", async (c) => {
    const workspace = requireWorkspace(c);
    return c.json(await deps.settings.getStatus(workspace.userId));
  });

  const SaveSchema = z.object({
    kind: z.enum(PROVIDER_KINDS),
    baseUrl: z.string().min(1).max(512),
    model: z.string().min(1).max(255),
    apiKey: z.string().max(256).optional(),
  });
  routes.put("/", zValidator("json", SaveSchema), async (c) => {
    const workspace = requireWorkspace(c);
    return c.json(await deps.settings.save(workspace.userId, c.req.valid("json")));
  });

  routes.delete("/", async (c) => {
    const workspace = requireWorkspace(c);
    await deps.settings.remove(workspace.userId);
    return c.json({ ok: true });
  });

  return routes;
}
