import { spawn } from "node:child_process";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";

export function createShellTool(baseDir: string, shellAvailable: boolean) {
  return defineTool({ name: "general:execute_shell", connector: "workspace", permission: "shell",
    description: "Jalankan command coding/test/build di host server dengan working directory workspace agent. Memerlukan izin shell. Bukan sandbox; jangan mengakses kredensial server. Tidak mengulang command gagal/timeout tanpa verifikasi.",
    schema: z.object({ command: z.string().min(1).max(8000), cwd: z.string().max(1000).default("."), timeoutMs: z.number().int().min(1000).max(30000).default(15000) }).strict(),
    parameters: objectSchema({ command: stringField, cwd: stringField, timeoutMs: { type: "integer", minimum: 1000, maximum: 30000 } }, ["command"]),
    execute: async (args, run, signal) => {
      if (!shellAvailable) throw new Error("Shell dinonaktifkan oleh server. Operator dapat mengatur AGENT_SHELL_ENABLED=true.");
      const cwd = await workspacePath(await workspaceRoot(baseDir, run.userId), args.cwd);
      signal?.throwIfAborted();
      return new Promise((resolveResult, reject) => {
        const windows = process.platform === "win32";
        const child = spawn(windows ? "powershell.exe" : "/bin/sh", windows ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", args.command] : ["-c", args.command], {
          cwd, detached: !windows, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
          // No provider keys, database paths, or router credentials inherited.
          env: Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].flatMap((key) => process.env[key] ? [[key, process.env[key]!]] : [])),
        });
        let output = "", timedOut = false;
        const stop = () => {
          if (windows && child.pid) spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => child.kill());
          else { try { if (child.pid) process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } }
        };
        const timer = setTimeout(() => { timedOut = true; stop(); }, args.timeoutMs);
        signal?.addEventListener("abort", stop, { once: true });
        const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", stop); };
        const collect = (chunk: Buffer) => { if (output.length < 12000) output += chunk.toString().slice(0, 12000 - output.length); };
        child.stdout.on("data", collect); child.stderr.on("data", collect);
        child.on("error", (err) => { cleanup(); reject(err); });
        child.on("close", (exitCode) => { cleanup(); resolveResult({ exitCode, timedOut, cancelled: signal?.aborted ?? false, output, outputLimit: 12000 }); });
      });
    },
  });
}
