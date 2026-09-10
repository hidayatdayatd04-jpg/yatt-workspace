import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { IntegrationKindSchema, IntegrationSettingsSchema } from "@shared/index";
import type { Env } from "../types";
import type { IntegrationService } from "../services/integrations";
import { requireWorkspace } from "../middleware/session";
import { AppError } from "../lib/errors";
import { googleRequest, telegramRequest } from "../tools/integrations/http";

export function createIntegrationRoutes(service: IntegrationService, shellAvailable: boolean) {
  const routes = new Hono<Env>();
  const kind = (value: string) => { const result = IntegrationKindSchema.safeParse(value); if (!result.success) throw new AppError("NOT_FOUND", "Connector tidak ditemukan.", 404); return result.data; };
  routes.get("/", async (c) => c.json({ integrations: await service.list(requireWorkspace(c).userId), shellAvailable }));
  routes.put("/:kind", zValidator("json", IntegrationSettingsSchema), async (c) => {
    const input = c.req.valid("json");
    if (input.allowShell && !shellAvailable) throw new AppError("FORBIDDEN", "Operator belum mengaktifkan AGENT_SHELL_ENABLED di server.", 403);
    return c.json({ integration: await service.save(requireWorkspace(c).userId, kind(c.req.param("kind")), input) });
  });
  routes.delete("/:kind", async (c) => { await service.remove(requireWorkspace(c).userId, kind(c.req.param("kind"))); return c.json({ ok: true }); });
  routes.post("/:kind/test", async (c) => {
    const userId = requireWorkspace(c).userId, selected = kind(c.req.param("kind"));
    await service.assertAllowed(userId, selected);
    if (selected === "mikrotik" || selected === "workspace") throw new AppError("VALIDATION_FAILED", "Tes ini khusus layanan eksternal. Hubungkan router melalui chat.", 422);
    try {
      if (selected === "telegram") await telegramRequest(service, userId, "getMe");
      else if (selected === "google") await googleRequest(service, userId, "google", "/oauth2/v2/userinfo?fields=email");
      else if (selected === "calendar") await googleRequest(service, userId, "calendar", "/calendar/v3/users/me/calendarList?maxResults=1&fields=items(id)");
      else await googleRequest(service, userId, selected, selected === "drive" ? "/drive/v3/about?fields=user(displayName)" : "/gmail/v1/users/me/profile");
      await service.markChecked(userId, selected, null);
    } catch {
      const message = "Koneksi gagal. Periksa token, scope API, dan akses jaringan lalu uji ulang.";
      await service.markChecked(userId, selected, message);
      throw new AppError("UPSTREAM_ERROR", message, 502);
    }
    return c.json({ integration: await service.status(userId, selected) });
  });
  return routes;
}
