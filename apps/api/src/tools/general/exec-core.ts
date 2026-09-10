import { spawn, type ChildProcess } from "node:child_process";
import type { ToolResultError } from "../errors";
import { ToolResultError as Err } from "../errors";

/** Env allowlist — tanpa API key provider, path DB, atau kredensial apa pun. */
const SAFE_ENV_KEYS = ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"];

export interface ExecOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Kap output gabungan (HEAD+TAIL bila lebih). */
  maxOutput?: number;
  /** Nama command untuk pesan error. */
  label?: string;
}

export interface ExecResult {
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  stdout: string;
  stderr: string;
  output: string;
  truncated: boolean;
}

/** Kill tree proses lintas platform: taskkill /T /F (Windows) atau kill -group (POSIX). */
export function killTree(child: ChildProcess): void {
  const windows = process.platform === "win32";
  if (windows && child.pid) {
    spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => child.kill());
  } else {
    try {
      if (child.pid) process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

/**
 * Buffer output HEAD+TAIL: baris awal (diagnosis) + baris akhir (error
 * compiler/test umumnya di ekor) + penanda jumlah baris yang dilewati.
 */
function createOutputBuffer(max: number) {
  const head: string[] = [];
  const tail: string[] = [];
  let headChars = 0;
  let tailChars = 0;
  let overflow = 0;
  let overflowChars = 0;
  let truncated = false;
  const lineCount = () => head.length + tail.length + overflow;
  return {
    push(line: string) {
      const len = line.length + 1;
      if (headChars + len <= Math.floor(max / 2)) {
        head.push(line);
        headChars += len;
        return;
      }
      if (tailChars + len <= Math.floor(max / 2)) {
        tail.push(line);
        tailChars += len;
        return;
      }
      const oldest = tail.shift();
      if (oldest !== undefined) {
        tailChars -= oldest.length + 1;
        overflowChars += oldest.length + 1;
      }
      tail.push(line);
      tailChars += len;
      overflow += 1;
      truncated = true;
    },
    finish(): { output: string; truncated: boolean; lines: number } {
      const skipped = `${overflow} baris tengah dilewati (${overflowChars} karakter)`;
      const body = overflow > 0 ? [...head, `[… ${skipped} …]`, ...tail] : [...head, ...tail];
      return { output: body.join("\n"), truncated, lines: lineCount() };
    },
  };
}

/** Eksekusi command satu kali dengan timeout, abort, kill tree, dan buffer aman. */
export async function execCommand(opts: ExecOptions): Promise<ExecResult> {
  const max = opts.maxOutput ?? 12_000;
  return new Promise<ExecResult>((resolveResult, reject) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      detached: !process.platform.startsWith("win"),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: Object.fromEntries(SAFE_ENV_KEYS.flatMap((key) => (process.env[key] ? [[key, process.env[key]!]] : []))),
    });
    let timedOut = false;
    let settled = false;
    const stdoutBuf = createOutputBuffer(max);
    const stderrBuf = createOutputBuffer(max);
    const onLine = (buf: ReturnType<typeof createOutputBuffer>) => (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) buf.push(line.replace(/\r$/, ""));
    };
    const stop = () => killTree(child);
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, opts.timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", stop);
    };
    opts.signal?.addEventListener("abort", stop, { once: true });
    child.stdout?.on("data", onLine(stdoutBuf));
    child.stderr?.on("data", onLine(stderrBuf));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      const notFound = (err as NodeJS.ErrnoException).code === "ENOENT";
      reject(new Err(notFound ? "COMMAND_NOT_FOUND" : "COMMAND_FAILED", `Gagal menjalankan ${opts.label ?? opts.command}: ${err.message}`));
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      cleanup();
      const out = stdoutBuf.finish();
      const errOut = stderrBuf.finish();
      resolveResult({
        exitCode,
        timedOut,
        cancelled: opts.signal?.aborted ?? false,
        stdout: out.output,
        stderr: errOut.output,
        output: [out.output, errOut.output].filter(Boolean).join("\n"),
        truncated: out.truncated || errOut.truncated,
      });
    });
  });
}

export type { ToolResultError };
