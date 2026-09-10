import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { execCommand } from "./exec-core";

/**
 * compute:execute_python — jalankan skrip Python pendek untuk perhitungan/
 * analisis data. Bukan sandbox penuh: env disanitasi, timeout ketat, output
 * dibatasi; working dir sementara per eksekusi. Gunakan hanya untuk operasi
 * yang sulit dilakukan tools data:/text: (jawaban sederhana dijawab langsung).
 */
export function createComputeTools(shellAvailable: boolean) {
  return [
    defineTool({ name: "compute:execute_python", connector: "workspace", permission: "shell", tags: ["compute", "python", "data", "execute"],
      description: "Jalankan skrip Python pendek (print stdout) untuk perhitungan kompleks/analisis data. Hanya bila tools data:/text: tidak cukup — pertanyaan hitung sederhana dijawab langsung tanpa tool. Python wajib tersedia di host.",
      schema: z.object({ script: z.string().min(1).max(100_000), timeoutMs: z.number().int().min(1000).max(30_000).default(15_000) }).strict(),
      parameters: objectSchema({ script: stringField, timeoutMs: { type: "integer", minimum: 1000, maximum: 30_000 } }, ["script"]),
      execute: async (args, run, signal) => {
        if (!shellAvailable) throw new ToolResultError("TOOL_NOT_ALLOWED", "Compute dinonaktifkan (izin shell connector Coding & Files nonaktif).");
        signal?.throwIfAborted();
        // Deteksi interpreter tersedia (python > py di Windows).
        const candidates = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
        const dir = await mkdtemp(join(tmpdir(), "yatt-compute-"));
        const file = join(dir, "script.py");
        await writeFile(file, args.script, "utf8");
        try {
          let lastError: ToolResultError | null = null;
          for (const cmd of candidates) {
            let result: Awaited<ReturnType<typeof execCommand>> | ToolResultError;
            try {
              result = await execCommand({ command: cmd, args: ["-I", file], cwd: dir, timeoutMs: args.timeoutMs, signal, maxOutput: 12_000, label: cmd });
            } catch (err) {
              if (err instanceof ToolResultError) result = err;
              else continue;
            }
            if (result instanceof ToolResultError) {
              if (result.code === "COMMAND_NOT_FOUND") { lastError = result; continue; }
              throw result;
            }
            return { interpreter: cmd, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, timedOut: result.timedOut, truncated: result.truncated };
          }
          throw lastError ?? new ToolResultError("DEPENDENCY_MISSING", "Python tidak ditemukan di host (python/python3/py). Minta pengguna menginstal Python atau gunakan tools data:.");
        } finally {
          await rm(dir, { recursive: true, force: true }).catch(() => {});
        }
      } }),
  ];
}
