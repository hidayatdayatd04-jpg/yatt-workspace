import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";
import type { WorkspaceProcessManager } from "../../services/workspace-processes";

const pathSchema = z.string().min(1).max(1000);

/** Tools proses panjang (dev server/watch) — output via polling, bukan blocking. */
export function createProcessTools(baseDir: string, shellAvailable: boolean, processes: WorkspaceProcessManager) {
  const startSchema = z.object({ command: z.string().min(1).max(8000), cwd: pathSchema.default(".") }).strict();
  return [
    defineTool({ name: "general:start_process", connector: "workspace", permission: "shell", tags: ["process", "shell", "execution"],
      description: "Mulai proses panjang (dev server, watch mode, server) di workspace dan langsung kembali — pantau lewat general:process_output/status, hentikan dengan general:stop_process. Untuk command singkat pakai general:execute_shell.",
      schema: startSchema, parameters: objectSchema({ command: stringField, cwd: stringField }, ["command"]),
      execute: async (args, run, signal) => {
        if (!shellAvailable) throw new ToolResultError("TOOL_NOT_ALLOWED", "Proses dinonaktifkan (izin shell connector Coding & Files nonaktif).");
        const cwd = await workspacePath(await workspaceRoot(baseDir, run.userId), args.cwd);
        signal?.throwIfAborted();
        try {
          return processes.start(run.userId, { command: args.command, cwd, signal });
        } catch (err) {
          throw new ToolResultError("TOOL_NOT_ALLOWED", err instanceof Error ? err.message : String(err));
        }
      } }),
    defineTool({ name: "general:process_output", connector: "workspace", permission: "shell", tags: ["process", "read"],
      description: "Baca output terbaru sebuah proses (ekor ring buffer).",
      schema: z.object({ processId: z.string().min(4).max(64), tailBytes: z.number().int().min(500).max(32_000).default(8_000) }).strict(),
      parameters: objectSchema({ processId: stringField, tailBytes: { type: "integer", minimum: 500, maximum: 32_000 } }, ["processId"]),
      execute: async (args, _run) => processes.output(args.processId, _run.userId, args.tailBytes) ?? (() => { throw new ToolResultError("PROCESS_NOT_FOUND", `Proses ${args.processId} tidak ditemukan.`); })() }),
    defineTool({ name: "general:process_status", connector: "workspace", permission: "shell", tags: ["process", "read"],
      description: "Status satu proses atau seluruh proses aktif milik pengguna (processId opsional).",
      schema: z.object({ processId: z.string().min(4).max(64).optional() }).strict(),
      parameters: objectSchema({ processId: stringField }),
      execute: async (args, run) => args.processId
        ? { processes: [processes.status(args.processId, run.userId) ?? (() => { throw new ToolResultError("PROCESS_NOT_FOUND", `Proses ${args.processId} tidak ditemukan.`); })()] }
        : { processes: processes.list(run.userId) } }),
    defineTool({ name: "general:stop_process", connector: "workspace", permission: "shell", tags: ["process", "execution"],
      description: "Hentikan proses beserta seluruh child-nya (kill tree).",
      schema: z.object({ processId: z.string().min(4).max(64) }).strict(),
      parameters: objectSchema({ processId: stringField }, ["processId"]),
      execute: async (args, _run) => {
        if (!processes.stop(args.processId, "user")) throw new ToolResultError("PROCESS_NOT_FOUND", `Proses ${args.processId} tidak ditemukan (atau sudah berhenti).`);
        return { processId: args.processId, stopped: true };
      } }),
  ];
}
