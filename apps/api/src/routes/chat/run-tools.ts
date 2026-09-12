import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors";
import { redactObject, redactText } from "../../lib/redaction";
import { agentRuns, toolExecutions } from "../../db/schema";
import type { Env } from "../../types";
import { requireWorkspace } from "./helpers";
import type { ChatCtx } from "./types";

/** Detail satu eksekusi tool (untuk Tool Card LEVEL 2/3 di web). */
export function registerRunToolRoutes(routes: Hono<Env>, ctx: ChatCtx) {
  const { deps } = ctx;

  routes.get("/api/runs/:id/tools/:callId", async (c) => {
    const workspace = requireWorkspace(c);
    const runId = c.req.param("id");
    const callId = c.req.param("callId");
    const [run] = await deps.db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.userId, workspace.userId)))
      .limit(1);
    if (!run) throw new AppError("NOT_FOUND", "Run tidak ditemukan.", 404);
    const [row] = await deps.db
      .select()
      .from(toolExecutions)
      .where(and(eq(toolExecutions.runId, runId), eq(toolExecutions.toolCallId, callId)))
      .limit(1);
    if (!row) throw new AppError("NOT_FOUND", "Eksekusi tool tidak ditemukan.", 404);
    // Kolom sudah ter-redact saat ditulis; sapu sekali lagi (defense in depth).
    return c.json({
      toolName: row.toolName,
      status: row.status,
      input: redactObject(row.sanitizedInput ?? {}),
      output: redactText(row.resultSummary ?? ""),
      errorCode: row.errorCode,
      durationMs: row.durationMs,
      startedAt: row.startedAt instanceof Date ? row.startedAt.getTime() : row.startedAt,
    });
  });
}
