import { eq } from "drizzle-orm";
import type { Database } from "../../db";
import { monitoringSettings, routerConnections } from "../../db/schema";
import type { Logger } from "../../lib/logger";
import type { MonitoringService } from "../monitoring";

export interface WatcherDeps {
  db: Database;
  monitoring: MonitoringService;
  logger: Logger;
  defaultIntervalMs: number;
}

export interface WatcherSettings {
  watcherEnabled: boolean;
  intervalMs: number;
}

export async function getWatcherSettings(db: Database, userId: string): Promise<WatcherSettings> {
  const [row] = await db.select().from(monitoringSettings).where(eq(monitoringSettings.userId, userId)).limit(1);
  return {
    watcherEnabled: row?.watcherEnabled ?? true,
    intervalMs: clampInterval(row?.intervalMs ?? 180_000),
  };
}

export async function updateWatcherSettings(db: Database, userId: string, input: Partial<WatcherSettings>): Promise<WatcherSettings> {
  const current = await getWatcherSettings(db, userId);
  const next: WatcherSettings = {
    watcherEnabled: input.watcherEnabled ?? current.watcherEnabled,
    intervalMs: input.intervalMs !== undefined ? clampInterval(input.intervalMs) : current.intervalMs,
  };
  await db
    .insert(monitoringSettings)
    .values({ userId, watcherEnabled: next.watcherEnabled, intervalMs: next.intervalMs })
    .onConflictDoUpdate({
      target: monitoringSettings.userId,
      set: { watcherEnabled: next.watcherEnabled, intervalMs: next.intervalMs, updatedAt: new Date() },
    });
  return next;
}

export function clampInterval(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 180_000;
  return Math.min(900_000, Math.max(60_000, Math.floor(n)));
}

/** Satu putaran poll: semua connector connected → fetchLive (alert+dedup otomatis). */
export async function pollOnce(deps: WatcherDeps): Promise<{ checked: number; errors: number }> {
  const rows = await deps.db
    .select({ userId: routerConnections.userId, id: routerConnections.id })
    .from(routerConnections)
    .where(eq(routerConnections.status, "connected"));
  let checked = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const settings = await getWatcherSettings(deps.db, row.userId);
      if (!settings.watcherEnabled) continue;
      await deps.monitoring.fetchLive(row.userId, row.id);
      checked += 1;
    } catch (err) {
      errors += 1;
      deps.logger.warn("monitoring watcher poll failed", {
        connectionId: row.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { checked, errors };
}

/** Background poller: interval global, toggle per-user. Berhenti bersih via stop(). */
export function createMonitoringWatcher(deps: WatcherDeps) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void pollOnce(deps)
      .catch((err) => deps.logger.warn("monitoring watcher tick failed", { message: err instanceof Error ? err.message : String(err) }))
      .finally(() => {
        running = false;
      });
  };
  return {
    start(intervalMs?: number) {
      if (timer) return;
      const ms = clampInterval(intervalMs ?? deps.defaultIntervalMs);
      timer = setInterval(tick, ms);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tick,
  };
}

export type MonitoringWatcher = ReturnType<typeof createMonitoringWatcher>;
