import { Hono } from "hono";
import type { Env as HonoEnv } from "../types";
import { AppError } from "../lib/errors";
import type { Database } from "../db";
import type { MonitoringService } from "../services/monitoring";
import { getWatcherSettings, updateWatcherSettings } from "../services/monitoring/watcher";

export function createMonitoringRoutes(deps: { monitoring: MonitoringService; db: Database }) {
  const app = new Hono<HonoEnv>();

  // GET /api/monitoring/:connectionId/live
  app.get("/:connectionId/live", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    const connectionId = c.req.param("connectionId");
    const data = await deps.monitoring.fetchLive(workspace.userId, connectionId);
    return c.json(data);
  });

  // GET /api/monitoring/:connectionId/history
  app.get("/:connectionId/history", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    const connectionId = c.req.param("connectionId");
    const range = (c.req.query("range") ?? "1h") as "1h" | "24h" | "7d";
    if (!["1h", "24h", "7d"].includes(range)) {
      throw new AppError("VALIDATION_FAILED", "Range harus 1h, 24h, atau 7d.", 422);
    }
    const history = await deps.monitoring.getHistory(workspace.userId, connectionId, range);
    return c.json({ history });
  });

  // POST /api/monitoring/:connectionId/refresh
  app.post("/:connectionId/refresh", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    const connectionId = c.req.param("connectionId");
    const data = await deps.monitoring.fetchLive(workspace.userId, connectionId);
    return c.json(data);
  });

  // GET /api/monitoring/settings/watcher — toggle + interval poller proaktif
  app.get("/settings/watcher", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    return c.json(await getWatcherSettings(deps.db, workspace.userId));
  });

  // PUT /api/monitoring/settings/watcher
  app.put("/settings/watcher", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    const body = (await c.req.json().catch(() => null)) as { watcherEnabled?: unknown; intervalMs?: unknown } | null;
    return c.json(
      await updateWatcherSettings(deps.db, workspace.userId, {
        ...(typeof body?.watcherEnabled === "boolean" ? { watcherEnabled: body.watcherEnabled } : {}),
        ...(body?.intervalMs !== undefined ? { intervalMs: Number(body.intervalMs) } : {}),
      }),
    );
  });

  return app;
}
