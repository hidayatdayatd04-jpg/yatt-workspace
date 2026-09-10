import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";
import { execCommand } from "./exec-core";
import { ToolResultError } from "../errors";

const SHELL_UNAVAILABLE = "Shell dinonaktifkan oleh server. Operator dapat mengatur AGENT_SHELL_ENABLED=true.";

export function createShellTool(baseDir: string, shellAvailable: boolean) {
  return defineTool({ name: "general:execute_shell", connector: "workspace", permission: "shell", tags: ["shell", "execution"],
    description: "Jalankan command coding/test/build di host server dengan working directory workspace agent. Untuk baca file/list/cari kode/git/ekstrak arsip/proses panjang, pakai tool spesialis (read_file/search_code/git:/extract_zip/start_process), bukan shell ini. Memerlukan izin shell. Bukan sandbox; jangan mengakses kredensial server. Tidak mengulang command gagal/timeout tanpa verifikasi.",
    schema: z.object({ command: z.string().min(1).max(8000), cwd: z.string().max(1000).default("."), timeoutMs: z.number().int().min(1000).max(30000).default(15000) }).strict(),
    parameters: objectSchema({ command: stringField, cwd: stringField, timeoutMs: { type: "integer", minimum: 1000, maximum: 30000 } }, ["command"]),
    execute: async (args, run, signal) => {
      if (!shellAvailable) throw new ToolResultError("TOOL_NOT_ALLOWED", SHELL_UNAVAILABLE, { guidance: "Arahkan pengguna mengaktifkan izin shell untuk connector Coding & Files di halaman Connectors." });
      const cwd = await workspacePath(await workspaceRoot(baseDir, run.userId), args.cwd);
      signal?.throwIfAborted();
      const windows = process.platform === "win32";
      const result = await execCommand({
        command: windows ? "powershell.exe" : "/bin/sh",
        args: windows ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", args.command] : ["-c", args.command],
        cwd, timeoutMs: args.timeoutMs, signal, maxOutput: 12_000, label: "shell",
      });
      return {
        exitCode: result.exitCode, timedOut: result.timedOut, cancelled: result.cancelled,
        stdout: result.stdout, stderr: result.stderr, truncated: result.truncated,
      };
    },
  });
}
