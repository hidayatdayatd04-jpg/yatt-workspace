import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { workspaceRoot } from "../general/files";
import { execCommand } from "../general/exec-core";
import { ToolResultError } from "../errors";

const GIT_TIMEOUT = 20_000;

/** Jalankan git CLI di root workspace user; kembalikan structured result. */
export async function runGit(cwd: string, args: string[], timeoutMs = GIT_TIMEOUT): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  const result = await execCommand({ command: "git", args, cwd, timeoutMs, maxOutput: 10_000, label: `git ${args[0]}` });
  return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, timedOut: result.timedOut };
}

function gitNotRepoError(): ToolResultError {
  return new ToolResultError("DEPENDENCY_MISSING", "Folder kerja bukan repositori git (git tidak menemukan .git).", { guidance: "Informasikan pengguna bahwa folder ini belum di-init sebagai repositori git." });
}

export function createGitReadTools(baseDir: string) {
  const root = async (userId: string) => workspaceRoot(baseDir, userId);
  const needsRepo = async (userId: string) => {
    const check = await runGit(await root(userId), ["rev-parse", "--is-inside-work-tree"]);
    if (check.exitCode !== 0) throw gitNotRepoError();
  };
  const boolean = { type: "boolean" } as const;
  return [
    defineTool({ name: "git:status", connector: "workspace", tags: ["git", "read", "vcs"],
      description: "Status repositori git workspace (branch, file berubah, staged) — format porcelain + ringkasan.",
      schema: z.object({}).strict(), parameters: objectSchema({}),
      execute: async (_args, run) => { await needsRepo(run.userId); return gitJson(await root(run.userId), ["status", "--porcelain=v1", "--branch"]); } }),
    defineTool({ name: "git:diff", connector: "workspace", tags: ["git", "read", "vcs"],
      description: "Diff perubahan (unstaged, staged dengan staged:true, atau terhadap commit dengan ref).",
      schema: z.object({ staged: z.boolean().default(false), ref: z.string().max(200).optional(), path: z.string().max(1000).optional() }).strict(),
      parameters: objectSchema({ staged: boolean, ref: stringField, path: stringField }),
      execute: async (args, run) => {
        await needsRepo(run.userId);
        const argv = ["diff", ...(args.staged ? ["--cached"] : []), ...(args.ref ? [args.ref] : []), "--stat", "--patch", ...(args.path ? ["--", args.path] : [])];
        return gitJson(await root(run.userId), argv);
      } }),
    defineTool({ name: "git:log", connector: "workspace", tags: ["git", "read", "vcs"],
      description: "Riwayat commit terformat ringkas (hash, author, tanggal, subjek) — max hingga 50.",
      schema: z.object({ maxCount: z.number().int().min(1).max(50).default(10), ref: z.string().max(200).optional() }).strict(),
      parameters: objectSchema({ maxCount: { type: "integer", minimum: 1, maximum: 50 }, ref: stringField }),
      execute: async (args, run) => {
        await needsRepo(run.userId);
        const out = await runGit(await root(run.userId), ["log", `--max-count=${args.maxCount}`, "--pretty=format:%h%x09%an%x09%ad%x09%s", "--date=short", ...(args.ref ? [args.ref] : [])]);
        return { commits: out.stdout.split("\n").filter(Boolean).map((line) => { const [hash, author, date, ...subject] = line.split("\t"); return { hash, author, date, subject: subject.join("\t") }; }), ...out };
      } }),
    defineTool({ name: "git:show", connector: "workspace", tags: ["git", "read", "vcs"],
      description: "Tampilkan satu commit (metadata + diff) — ref/hash/branch.",
      schema: z.object({ ref: z.string().min(1).max(200) }).strict(),
      parameters: objectSchema({ ref: stringField }, ["ref"]),
      execute: async (args, run) => { await needsRepo(run.userId); return gitJson(await root(run.userId), ["show", "--stat", "--patch", args.ref]); } }),
    defineTool({ name: "git:branches", connector: "workspace", tags: ["git", "read", "vcs"],
      description: "Daftar branch lokal (dan remote dengan remotes:true) beserta penanda current.",
      schema: z.object({ remotes: z.boolean().default(false) }).strict(),
      parameters: objectSchema({ remotes: boolean }),
      execute: async (args, run) => {
        await needsRepo(run.userId);
        const out = await runGit(await root(run.userId), ["branch", ...(args.remotes ? ["-a"] : []), "--format=%(HEAD)%(refname:short)"]);
        return { branches: out.stdout.split("\n").filter(Boolean).map((line) => ({ current: line.startsWith("*"), name: line.replace(/^\*?\s?/, "").trim() })), ...out };
      } }),
    defineTool({ name: "git:changed_files", connector: "workspace", tags: ["git", "read", "vcs"],
      description: "File yang berubah (status + jumlah perubahan) — ringkas untuk survei cepat.",
      schema: z.object({ ref: z.string().max(200).optional() }).strict(),
      parameters: objectSchema({ ref: stringField }),
      execute: async (args, run) => {
        await needsRepo(run.userId);
        const out = await runGit(await root(run.userId), ["diff", "--name-status", ...(args.ref ? [args.ref] : [])]);
        return { files: out.stdout.split("\n").filter(Boolean).map((line) => { const [status, path] = line.split("\t"); return { status, path }; }), ...out };
      } }),
    defineTool({ name: "git:compare", connector: "workspace", tags: ["git", "read", "vcs"],
      description: "Bandingkan dua ref (commit/branch) — file berubah + ringkasan diff.",
      schema: z.object({ from: z.string().min(1).max(200), to: z.string().min(1).max(200) }).strict(),
      parameters: objectSchema({ from: stringField, to: stringField }, ["from", "to"]),
      execute: async (args, run) => { await needsRepo(run.userId); return gitJson(await root(run.userId), ["diff", "--stat", "--patch", `${args.from}...${args.to}`]); } }),
  ];
}

/** Konversi stdout git terformat JSON dengan pemisahan baris bersih. */
async function gitJson(cwd: string, argv: string[]) {
  const out = await runGit(cwd, argv);
  return { exitCode: out.exitCode, output: out.stdout || out.stderr, timedOut: out.timedOut };
}
