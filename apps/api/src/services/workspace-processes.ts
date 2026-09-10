import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Logger } from "../lib/logger";

/** Manajer proses workspace (dev server/watch) — in-memory per user, ring buffer output. */
export interface WorkspaceProcessInfo {
  processId: string;
  pid: number | null;
  userId: string;
  command: string;
  cwd: string;
  status: "running" | "exited" | "killed" | "failed";
  exitCode: number | null;
  startedAt: number;
  lastOutputAt: number;
  bytesOut: number;
}

const RING_MAX_BYTES = 64 * 1024;

interface Entry extends WorkspaceProcessInfo {
  child: ChildProcess;
  ring: string[];
  ringBytes: number;
}

export interface ProcessLimits {
  maxPerUser: number;
  maxTotal: number;
  idleMs: number;
}

export function createWorkspaceProcessManager(limits: ProcessLimits, logger: Logger) {
  const procs = new Map<string, Entry>();
  const byUser = new Map<string, Set<string>>();
  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  const touchOutput = (entry: Entry, chunk: Buffer) => {
    const line = chunk.toString().replace(/\r\n/g, "\n");
    entry.ring.push(line);
    entry.ringBytes += line.length;
    entry.bytesOut += line.length;
    while (entry.ringBytes > RING_MAX_BYTES && entry.ring.length > 1) {
      const dropped = entry.ring.shift()!;
      entry.ringBytes -= dropped.length;
    }
  };

  const killTree = (entry: Entry) => {
    if (entry.child.pid && process.platform === "win32") {
      spawn("taskkill.exe", ["/pid", String(entry.child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => entry.child.kill());
    } else {
      try {
        if (entry.child.pid) process.kill(-entry.child.pid, "SIGKILL");
      } catch {
        entry.child.kill("SIGKILL");
      }
    }
  };

  const stop = (processId: string, reason: "user" | "idle" | "shutdown"): boolean => {
    const entry = procs.get(processId);
    if (!entry) return false;
    killTree(entry);
    entry.status = reason === "user" ? "killed" : entry.status === "running" ? "killed" : entry.status;
    if (reason !== "shutdown") {
      procs.delete(processId);
      byUser.get(entry.userId)?.delete(processId);
    }
    logger.info("workspace process stopped", { processId, reason, command: entry.command });
    return true;
  };

  return {
    start(userId: string, args: { command: string; cwd: string; signal?: AbortSignal; env?: Record<string, string> }): WorkspaceProcessInfo {
      const userSet = byUser.get(userId) ?? new Set<string>();
      if (userSet.size >= limits.maxPerUser) throw new Error(`Batas ${limits.maxPerUser} proses per pengguna tercapai. Hentikan proses lain dengan general:stop_process.`);
      if (procs.size >= limits.maxTotal) throw new Error(`Batas ${limits.maxTotal} proses total tercapai.`);
      const windows = process.platform === "win32";
      const child = spawn(windows ? "powershell.exe" : "/bin/sh", windows ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", args.command] : ["-c", args.command], {
        cwd: args.cwd, detached: !windows, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
        env: Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].flatMap((key) => (process.env[key] ? [[key, process.env[key]!]] : []))),
      });
      const processId = `proc_${randomUUID().slice(0, 8)}`;
      const entry: Entry = { processId, pid: child.pid ?? null, userId, command: args.command, cwd: args.cwd, status: "running", exitCode: null, startedAt: Date.now(), lastOutputAt: Date.now(), bytesOut: 0, child, ring: [], ringBytes: 0 };
      procs.set(processId, entry);
      userSet.add(processId);
      byUser.set(userId, userSet);
      child.stdout?.on("data", (chunk: Buffer) => touchOutput(entry, chunk));
      child.stderr?.on("data", (chunk: Buffer) => touchOutput(entry, chunk));
      child.on("error", (err) => { entry.status = "failed"; logger.warn("workspace process error", { processId, message: err.message }); });
      child.on("close", (exitCode) => { entry.status = exitCode === 0 ? "exited" : entry.status === "killed" ? "killed" : "exited"; entry.exitCode = exitCode; });
      args.signal?.addEventListener("abort", () => stop(processId, "user"), { once: true });
      return { processId, pid: entry.pid, userId, command: entry.command, cwd: entry.cwd, status: "running", exitCode: null, startedAt: entry.startedAt, lastOutputAt: entry.lastOutputAt, bytesOut: 0 };
    },
    output(processId: string, userId: string, tailBytes = 8_000): { processId: string; status: string; output: string; truncated: boolean } | null {
      const entry = procs.get(processId);
      if (!entry || entry.userId !== userId) return null;
      const full = entry.ring.join("\n");
      return { processId, status: entry.status, output: full.length > tailBytes ? full.slice(-tailBytes) : full, truncated: entry.bytesOut > tailBytes };
    },
    status(processId: string, userId: string): WorkspaceProcessInfo | null {
      const entry = procs.get(processId);
      if (!entry || entry.userId !== userId) return null;
      const { child: _child, ring: _ring, ringBytes: _ringBytes, ...info } = entry;
      return info;
    },
    list(userId: string): WorkspaceProcessInfo[] {
      return [...procs.values()].filter((e) => e.userId === userId).map(({ child: _c, ring: _r, ringBytes: _rb, ...info }) => info);
    },
    stop,
    /** Sweep idle: hentikan proses tanpa output selama idleMs. Mulai otomatis; kembalikan stopper. */
    startSweep(): () => void {
      sweepTimer = setInterval(() => {
        const now = Date.now();
        for (const [id, entry] of procs) {
          if (entry.status === "running" && now - entry.lastOutputAt > limits.idleMs) stop(id, "idle");
        }
      }, Math.min(limits.idleMs / 4, 60_000));
      sweepTimer.unref?.();
      return () => {
        if (sweepTimer) clearInterval(sweepTimer);
        sweepTimer = null;
      };
    },
    disposeAll(): void {
      for (const id of [...procs.keys()]) stop(id, "shutdown");
      procs.clear();
      byUser.clear();
    },
  };
}

export type WorkspaceProcessManager = ReturnType<typeof createWorkspaceProcessManager>;
