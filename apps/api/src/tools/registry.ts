import { createSkillReadTool } from "./general/skills";
import { createAttachmentReadTools } from "./general/attachment-read";
import type { Database } from "../db";
import type { IntegrationService } from "../services/integrations";
import type { ConnectorService } from "../services/connector";
import type { McpSupervisor } from "../mcp/supervisor";
import type { TransactionCoordinator } from "../transactions/coordinator";
import type { StartRunInput } from "../agent/loop/types";
import type { Logger } from "../lib/logger";
import { createConnectionTools } from "./mikrotik/connection";
import { createFileTools } from "./general/files";
import { createShellTool } from "./general/shell";
import { createSearchTools } from "./general/search";
import { createPatchTools } from "./general/patch";
import { createProjectTools } from "./general/project";
import { createProcessTools } from "./general/process";
import { createGitReadTools } from "./git/git-read";
import { createGitWriteTools } from "./git/git-write";
import { createWebFetchTool } from "./general/web-fetch";
import { createDataTools } from "./general/data";
import { createCsvTools } from "./general/csv";
import { createTextTools } from "./general/text";
import { createSystemTools } from "./general/system";
import { createComputeTools } from "./general/compute";
import { createArchiveTools } from "./general/archive";
import { createOfficeReadTools } from "./general/office-read";
import { createOfficeXlsxTools } from "./general/office-xlsx";
import { createOfficeDocxTools } from "./general/office-docx";
import { createOfficePdfTools } from "./general/office-pdf";
import { createOfficePptxTools } from "./general/office-pptx";
import { createDriveTools } from "./integrations/drive";
import { createGDocsTools } from "./integrations/gdocs";
import { createGSheetsTools } from "./integrations/gsheets";
import { createGSlidesTools } from "./integrations/gslides";
import { createGmailTools } from "./integrations/gmail";
import { createCalendarTools } from "./integrations/calendar";
import { createTelegramTools } from "./integrations/telegram";
import { AppError } from "../lib/errors";
import { redactObject } from "../lib/redaction";
import { toolErrorBody } from "./errors";
import { createAttachmentTool } from "./general/attachments";
import type { WorkspaceProcessManager } from "../services/workspace-processes";

export function createAgentToolRegistry(deps: { db: Database; integrations: IntegrationService; connectors: ConnectorService; supervisor: McpSupervisor; transactions: TransactionCoordinator; dataDir: string; shellAvailable: boolean; logger: Logger; processes: WorkspaceProcessManager; readObject?: (key: string) => Promise<Buffer>; describeImage?: Parameters<typeof createAttachmentReadTools>[0]["describeImage"] }) {
  const { processes } = deps;
  const tools = [
    createSkillReadTool(),
    ...createConnectionTools(deps),
    ...createFileTools(deps.dataDir, deps.describeImage),
    ...(deps.readObject ? [createAttachmentTool({ ...deps, readObject: deps.readObject }), ...createAttachmentReadTools({ ...deps, readObject: deps.readObject })] : []),
    createShellTool(deps.dataDir, deps.shellAvailable),
    ...createSearchTools(deps.dataDir),
    ...createPatchTools(deps.dataDir),
    ...createProjectTools(deps.dataDir, deps.shellAvailable),
    ...createProcessTools(deps.dataDir, deps.shellAvailable, processes),
    ...createGitReadTools(deps.dataDir),
    ...createGitWriteTools(deps.dataDir),
    createWebFetchTool(),
    ...createDataTools(deps.dataDir),
    ...createCsvTools(deps.dataDir),
    ...createTextTools(),
    ...createSystemTools(deps.shellAvailable),
    ...createComputeTools(deps.shellAvailable),
    ...createArchiveTools(deps.dataDir),
    ...createOfficeReadTools(deps.dataDir),
    ...createOfficeXlsxTools(deps.dataDir),
    ...createOfficeDocxTools(deps.dataDir),
    ...createOfficePdfTools(deps.dataDir),
    ...createOfficePptxTools(deps.dataDir),
    ...createDriveTools(deps.integrations),
    ...createGDocsTools(deps.integrations),
    ...createGSheetsTools(deps.integrations),
    ...createGSlidesTools(deps.integrations),
    ...createGmailTools(deps.integrations),
    ...createCalendarTools(deps.integrations),
    ...createTelegramTools(deps.integrations),
  ];
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
    async activityMetadata(name: string, args: unknown, run: StartRunInput) {
      const tool = byName.get(name);
      if (!tool?.activityMetadata) return {};
      await deps.integrations.assertAllowed(run.userId, tool.connector, tool.permission);
      return redactObject(await tool.activityMetadata(args, run)) as Record<string, unknown>;
    },
    async execute(name: string, args: unknown, run: StartRunInput, signal?: AbortSignal) {
      const tool = byName.get(name);
      if (!tool) throw new AppError("TOOL_UNSUPPORTED", "Tool agent tidak ditemukan.", 400);
      await deps.integrations.assertAllowed(run.userId, tool.connector, tool.permission);
      signal?.throwIfAborted();
      const parsed = tool.schema.safeParse(args);
      if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Argumen tool tidak sesuai skema.", 422);
      let result: unknown;
      try {
        result = await tool.execute(parsed.data, run, signal);
      } catch (err) {
        // Taksonomi error terstandar: {ok:false, error:{code,message,retryable,guidance}}
        return { ok: false, output: JSON.stringify(toolErrorBody(err)), errorCode: (toolErrorBody(err).error as { code: string }).code };
      }
      if (name === "general:execute_shell" || name === "project:run_script" || name === "compute:execute_python") {
        const shell = result as { exitCode: number | null; timedOut: boolean; cancelled: boolean };
        if (shell.timedOut || shell.cancelled || shell.exitCode !== 0) return { ok: false, output: JSON.stringify(result), errorCode: shell.timedOut ? "TOOL_TIMEOUT" : shell.cancelled ? "CANCELLED" : "COMMAND_FAILED" };
      }
      return { ok: true, output: JSON.stringify(result) };
    },
  };
}
export type AgentToolRegistry = ReturnType<typeof createAgentToolRegistry>;
