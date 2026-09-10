import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceProcessManager } from "../../services/workspace-processes";
import { createProcessTools } from "./process";
import { createGitReadTools } from "../git/git-read";
import { createGitWriteTools } from "../git/git-write";
import { workspaceRoot } from "./files";
import { execCommand } from "./exec-core";

const quietLogger = { info() {}, warn() {}, error() {}, debug() {} } as never;

describe("workspace process manager", () => {
  test("start, poll output, status list, stop with cleanup", async () => {
    const mgr = createWorkspaceProcessManager({ maxPerUser: 2, maxTotal: 4, idleMs: 60_000 }, quietLogger);
    const tools = createProcessTools(await mkdtemp(join(tmpdir(), "proc-")), true, mgr);
    const start = tools.find((t) => t.fqName === "general:start_process")!;
    const output = tools.find((t) => t.fqName === "general:process_output")!;
    const status = tools.find((t) => t.fqName === "general:process_status")!;
    const stop = tools.find((t) => t.fqName === "general:stop_process")!;
    const run = { userId: "u1" } as never;
    // Command lintas platform yang pasti menghasilkan output lalu keluar.
    const script = process.platform === "win32" ? "echo hello-proc; Start-Sleep -Milliseconds 300; echo done-proc" : "echo hello-proc; sleep 0.3; echo done-proc";
    const started = await start.execute({ command: script }, run) as { processId: string; status: string };
    expect(started.status).toBe("running");
    await new Promise((r) => setTimeout(r, 700));
    const out = await output.execute({ processId: started.processId }, run) as { output: string };
    expect(out.output).toContain("hello-proc");
    const list = await status.execute({}, run) as { processes: Array<{ processId: string }> };
    expect(list.processes.some((p) => p.processId === started.processId)).toBe(true);
    const stopped = await stop.execute({ processId: started.processId }, run) as { stopped: boolean };
    expect(stopped.stopped).toBe(true);
    await expect(output.execute({ processId: started.processId }, run)).rejects.toThrow("tidak ditemukan");
    mgr.disposeAll();
  });
  test("enforces per-user limit", async () => {
    const mgr = createWorkspaceProcessManager({ maxPerUser: 1, maxTotal: 4, idleMs: 60_000 }, quietLogger);
    const start = createProcessTools("/nonexistent", true, mgr).find((t) => t.fqName === "general:start_process")!;
    const run = { userId: "u1" } as never;
    // Entry tetap tercatat sampai stop/idle — echo cepat selesai pun tetap menghitung limit.
    await start.execute({ command: process.platform === "win32" ? "echo a" : "echo a" }, run);
    await expect(start.execute({ command: "echo b" }, run)).rejects.toThrow("Batas");
    mgr.disposeAll();
  });
});

describe("git tools", () => {
  test("read tools detect repo state; write tools need confirm", async () => {
    const base = await mkdtemp(join(tmpdir(), "git-tools-"));
    const root = await workspaceRoot(base, "git-user");
    const init = await execCommand({ command: "git", args: ["init"], cwd: root, timeoutMs: 10_000, maxOutput: 2000 });
    expect(init.exitCode).toBe(0);
    await writeFile(join(root, "a.txt"), "hello\n");
    await execCommand({ command: "git", args: ["add", "."], cwd: root, timeoutMs: 10_000, maxOutput: 2000 });
    await execCommand({ command: "git", args: ["-c", "user.email=t@t", "-c", "user.name=T", "commit", "-m", "init"], cwd: root, timeoutMs: 10_000, maxOutput: 2000 });
    const run = { userId: "git-user" } as never;
    const status = createGitReadTools(base).find((t) => t.fqName === "git:status")!;
    const st = await status.execute({}, run) as { output: string };
    expect(st.output).toMatch(/## (main|master)/);
    const log = createGitReadTools(base).find((t) => t.fqName === "git:log")!;
    const lg = await log.execute({ maxCount: 5 }, run) as { commits: Array<{ subject: string }> };
    expect(lg.commits[0]!.subject).toBe("init");
    const restore = createGitWriteTools(base).find((t) => t.fqName === "git:restore")!;
    await expect(restore.execute({ path: "a.txt" }, run)).rejects.toThrow("persetujuan");
    await writeFile(join(root, "a.txt"), "changed\n");
    const ok = await restore.execute({ path: "a.txt", confirm: "ya" }, run) as { restored: boolean };
    expect(ok.restored).toBe(true);
  });
  test("git tools report non-repo clearly", async () => {
    const base = await mkdtemp(join(tmpdir(), "git-empty-"));
    await workspaceRoot(base, "git-user2");
    const status = createGitReadTools(base).find((t) => t.fqName === "git:status")!;
    await expect(status.execute({}, { userId: "git-user2" } as never)).rejects.toThrow("repositori");
  });
});
