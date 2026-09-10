import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspaceRoot } from "../general/files";
import { runGit } from "./git-read";

/** Tool git mutasi: commit/add/branch ringan; restore/checkout butuh confirm. */
export function createGitWriteTools(baseDir: string) {
  const root = async (userId: string) => workspaceRoot(baseDir, userId);
  const requireConfirm = (tool: string, confirm: boolean | undefined, detail: string) => {
    if (confirm !== true) {
      throw new ToolResultError("USER_APPROVAL_REQUIRED", `Operasi git ${tool} membatalkan/menimpa perubahan lokal (${detail}). Tanyakan persetujuan eksplisit pengguna di chat dulu, lalu ulangi dengan confirm:"ya".`);
    }
  };
  return [
    defineTool({ name: "git:add", connector: "workspace", permission: "write", tags: ["git", "write", "vcs"],
      description: "Stage file (path spesifik atau \".\" untuk semua).",
      schema: z.object({ path: z.string().min(1).max(1000).default(".") }).strict(),
      parameters: objectSchema({ path: stringField }, ["path"]),
      execute: async (args, run) => (await runGit(await root(run.userId), ["add", "--", args.path])).exitCode === 0 ? { staged: args.path, ok: true } : { ok: false, error: "staging gagal" } }),
    defineTool({ name: "git:commit", connector: "workspace", permission: "write", tags: ["git", "write", "vcs"],
      description: "Commit perubahan yang sudah staged dengan pesan ringkas. Tidak melakukan push.",
      schema: z.object({ message: z.string().min(3).max(500) }).strict(),
      parameters: objectSchema({ message: stringField }, ["message"]),
      execute: async (args, run) => {
        const out = await runGit(await root(run.userId), ["commit", "-m", args.message]);
        return { committed: out.exitCode === 0, output: out.stdout || out.stderr };
      } }),
    defineTool({ name: "git:create_branch", connector: "workspace", permission: "write", tags: ["git", "write", "vcs"],
      description: "Buat branch baru (opsional checkout langsung).",
      schema: z.object({ name: z.string().min(1).max(200), checkout: z.boolean().default(false) }).strict(),
      parameters: objectSchema({ name: stringField, checkout: { type: "boolean" } }, ["name"]),
      execute: async (args, run) => {
        const out = await runGit(await root(run.userId), ["branch", args.name]);
        if (out.exitCode !== 0) return { created: false, output: out.stderr };
        if (args.checkout) {
          const co = await runGit(await root(run.userId), ["checkout", args.name]);
          return { created: true, checkedOut: co.exitCode === 0, output: co.stdout || co.stderr };
        }
        return { created: true, checkedOut: false };
      } }),
    defineTool({ name: "git:checkout", connector: "workspace", permission: "write", tags: ["git", "write", "vcs"],
      description: "Pindah branch/commit. MENIMPA perubahan lokal file yang bentrok — wajib konfirmasi pengguna (confirm).",
      schema: z.object({ ref: z.string().min(1).max(200), confirm: z.string().max(10).optional() }).strict(),
      parameters: objectSchema({ ref: stringField, confirm: stringField }, ["ref"]),
      execute: async (args, run) => {
        requireConfirm("checkout", args.confirm === "ya", `pindah ke ${args.ref}`);
        const out = await runGit(await root(run.userId), ["checkout", args.ref]);
        return { checkedOut: out.exitCode === 0, output: out.stdout || out.stderr };
      } }),
    defineTool({ name: "git:restore", connector: "workspace", permission: "write", tags: ["git", "write", "vcs", "destructive"],
      description: "Buang perubahan lokal file (kembali ke HEAD) — PERUBAHAN HILANG permanen. Wajib konfirmasi pengguna (confirm).",
      schema: z.object({ path: z.string().min(1).max(1000), staged: z.boolean().default(false), confirm: z.string().max(10).optional() }).strict(),
      parameters: objectSchema({ path: stringField, staged: { type: "boolean" }, confirm: stringField }, ["path"]),
      execute: async (args, run) => {
        requireConfirm("restore", args.confirm === "ya", `membuang perubahan ${args.path}`);
        const out = await runGit(await root(run.userId), ["restore", ...(args.staged ? ["--staged"] : []), "--", args.path]);
        return { restored: out.exitCode === 0, path: args.path, output: out.stdout || out.stderr };
      } }),
  ];
}
