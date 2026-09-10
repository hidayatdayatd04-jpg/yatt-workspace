import type { Database } from "../db";
import type { IntegrationService } from "../services/integrations";
import type { ConnectorService } from "../services/connector";
import type { McpSupervisor } from "../mcp/supervisor";
import type { TransactionCoordinator } from "../transactions/coordinator";
import type { StartRunInput } from "../agent/loop/types";
import { createConnectionTools } from "./mikrotik/connection";
import { createFileTools } from "./general/files";
import { createShellTool } from "./general/shell";
import { createDriveTools } from "./integrations/drive";
import { createGmailTools } from "./integrations/gmail";
import { createCalendarTools } from "./integrations/calendar";
import { createTelegramTools } from "./integrations/telegram";
import { AppError } from "../lib/errors";
import { createAttachmentTool } from "./general/attachments";

export function createAgentToolRegistry(deps: { db: Database; integrations: IntegrationService; connectors: ConnectorService; supervisor: McpSupervisor; transactions: TransactionCoordinator; dataDir: string; shellAvailable: boolean; readObject?: (key: string) => Promise<Buffer> }) {
  const tools = [...createConnectionTools(deps), ...createFileTools(deps.dataDir), ...(deps.readObject ? [createAttachmentTool({ ...deps, readObject: deps.readObject })] : []), createShellTool(deps.dataDir, deps.shellAvailable), ...createDriveTools(deps.integrations), ...createGmailTools(deps.integrations), ...createCalendarTools(deps.integrations), ...createTelegramTools(deps.integrations)];
  const byName = new Map(tools.map((tool) => [tool.fqName, tool]));
  return {
    async catalog(userId: string) {
      const states = await deps.integrations.list(userId);
      return tools.filter((tool) => {
        const state = states.find((s) => s.kind === tool.connector)!;
        return state.enabled && state.configured && (tool.permission === "read" || tool.permission === "write" && state.allowWrite || tool.permission === "send" && state.allowSend || tool.permission === "shell" && state.allowShell && deps.shellAvailable);
      });
    },
    has: (name: string) => byName.has(name),
    async execute(name: string, args: unknown, run: StartRunInput, signal?: AbortSignal) {
      const tool = byName.get(name);
      if (!tool) throw new AppError("TOOL_UNSUPPORTED", "Tool agent tidak ditemukan.", 400);
      await deps.integrations.assertAllowed(run.userId, tool.connector, tool.permission);
      signal?.throwIfAborted();
      const parsed = tool.schema.safeParse(args);
      if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Argumen tool tidak sesuai skema.", 422);
      const result = await tool.execute(parsed.data, run, signal);
      if (name === "general:execute_shell") {
        const shell = result as { exitCode: number | null; timedOut: boolean; cancelled: boolean };
        if (shell.timedOut || shell.cancelled || shell.exitCode !== 0) return { ok: false, output: JSON.stringify(result), errorCode: shell.timedOut ? "TOOL_TIMEOUT" : shell.cancelled ? "CANCELLED" : "TOOL_FAILED" };
      }
      return { ok: true, output: JSON.stringify(result) };
    },
  };
}
export type AgentToolRegistry = ReturnType<typeof createAgentToolRegistry>;
