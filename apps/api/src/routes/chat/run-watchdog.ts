import { and, inArray, lt } from "drizzle-orm";
import { agentRuns } from "../../db/schema";
import type { Database } from "../../db";
import type { Logger } from "../../lib/logger";

const SWEEP_INTERVAL_MS = 30_000;
/** Toleransi ekstra di atas runTimeoutMs sebelum run dianggap yatim. */
const GRACE_MS = 120_000;

/**
 * Watchdog run: proses crash/restart bisa meninggalkan baris agent_runs
 * berstatus queued/running selamanya — UI lalu memutar spinner tanpa ujung
 * karena tidak ada event terminal. Sweep ini menandai run usang sebagai
 * gagal; safety-net polling di web (3 detik) akan menutup spinner secara
 * otomatis begitu status terminal terlihat.
 */
export function startRunWatchdog(deps: { db: Database; logger: Logger; runTimeoutMs: number }): () => void {
  const cutoff = () => new Date(Date.now() - deps.runTimeoutMs - GRACE_MS);

  async function sweep(): Promise<void> {
    const rows = await deps.db
      .update(agentRuns)
      .set({ status: "failed", endedAt: new Date() })
      .where(and(inArray(agentRuns.status, ["queued", "running"]), lt(agentRuns.createdAt, cutoff())))
      .returning({ id: agentRuns.id, conversationId: agentRuns.conversationId });
    if (rows.length > 0) {
      deps.logger.warn("run watchdog: run usang ditandai gagal", { count: rows.length, ids: rows.map((r) => r.id).slice(0, 10) });
    }
  }

  const timer = setInterval(() => {
    void sweep().catch((err: unknown) => {
      deps.logger.error("run watchdog sweep gagal", { message: err instanceof Error ? err.message : String(err) });
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  void sweep().catch(() => {});
  return () => clearInterval(timer);
}
