import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";
import { execCommand } from "./exec-core";

const pathSchema = z.string().min(1).max(1000);

interface ProjectProfile {
  language: string;
  framework: string | null;
  packageManager: "bun" | "npm" | "pnpm" | "yarn" | null;
  scripts: Record<string, string>;
}

/** Deteksi profil project dari manifest/lockfile pada folder tertentu. */
async function detectProjectAt(root: string, dir: string): Promise<(ProjectProfile & { path: string; files: string[] }) | null> {
  const markers: Array<[string, string]> = [
    ["package.json", "js"], ["bun.lock", "bun"], ["bun.lockb", "bun"], ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["package-lock.json", "npm"],
    ["Cargo.toml", "rust"], ["go.mod", "go"], ["composer.json", "php"], ["requirements.txt", "python"], ["pyproject.toml", "python"], ["Gemfile", "ruby"], ["pom.xml", "java"], ["build.gradle", "java"], ["build.gradle.kts", "java"], ["Dockerfile", "docker"],
  ];
  const found: string[] = [];
  let pkgRaw: string | null = null;
  let language = "";
  let packageManager: ProjectProfile["packageManager"] = null;
  for (const [name, kind] of markers) {
    const text = await readFile(join(root, dir, name), "utf8").catch(() => null);
    if (text === null) continue;
    found.push(name);
    if (name === "package.json") {
      pkgRaw = text;
      language = "javascript/typescript";
    } else if (kind === "bun" && !packageManager) packageManager = "bun";
    else if (kind === "pnpm" && !packageManager) packageManager = "pnpm";
    else if (kind === "yarn" && !packageManager) packageManager = "yarn";
    else if (kind === "npm" && !packageManager) packageManager = "npm";
    else if (!language && kind !== "bun" && kind !== "pnpm" && kind !== "yarn" && kind !== "npm") language = { rust: "rust", go: "go", php: "php", python: "python", ruby: "ruby", java: "java", docker: "docker" }[kind] ?? "";
  }
  if (found.length === 0) return null;
  let scripts: Record<string, string> = {};
  let framework: string | null = null;
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      scripts = pkg.scripts ?? {};
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps?.react) framework = "React";
      else if (deps?.vue) framework = "Vue";
      else if (deps?.svelte) framework = "Svelte";
      else if (deps?.next) framework = "Next.js";
      else if (deps?.express || deps?.hono) framework = "Server";
      if (!packageManager) packageManager = "npm";
    } catch {
      /* package.json rusak — scripts kosong */
    }
  }
  return { path: dir === "." ? "" : dir, files: found, language: language || "unknown", framework, packageManager, scripts };
}

export function createProjectTools(baseDir: string, shellAvailable: boolean) {
  return [
    defineTool({ name: "project:detect", connector: "workspace", tags: ["project", "detect", "read"],
      description: "Deteksi jenis project (bahasa, package manager, framework, scripts) dari manifest/lockfile di workspace. Deteksi Bun menghindari pemakaian npm.",
      schema: z.object({ path: pathSchema.default(".") }).strict(), parameters: objectSchema({ path: stringField }),
      execute: async (args, run) => detectProjectAt(await workspaceRoot(baseDir, run.userId), args.path) ?? { found: false } }),
    defineTool({ name: "project:scripts", connector: "workspace", tags: ["project", "script", "read"],
      description: "Daftar scripts package.json (dan profil project) pada folder tertentu.",
      schema: z.object({ path: pathSchema.default(".") }).strict(), parameters: objectSchema({ path: stringField }),
      execute: async (args, run) => {
        const profile = await detectProjectAt(await workspaceRoot(baseDir, run.userId), args.path);
        return profile?.scripts && Object.keys(profile.scripts).length > 0 ? { path: args.path, scripts: profile.scripts, packageManager: profile.packageManager } : { scripts: {}, note: "Tidak ada package.json/scripts di folder ini." };
      } }),
    defineTool({ name: "project:run_script", connector: "workspace", permission: "shell", tags: ["project", "script", "shell", "execute"],
      description: "Jalankan script package.json (build/test/lint/dll) via package manager yang terdeteksi (bun/npm/pnpm/yarn). Lebih aman dari shell: command dibentuk dari nama script, bukan string bebas.",
      schema: z.object({ script: z.string().min(1).max(200), path: pathSchema.default("."), timeoutMs: z.number().int().min(1000).max(120_000).default(60_000) }).strict(),
      parameters: objectSchema({ script: stringField, path: stringField, timeoutMs: { type: "integer", minimum: 1000, maximum: 120_000 } }, ["script"]),
      execute: async (args, run, signal) => {
        if (!shellAvailable) throw new ToolResultError("TOOL_NOT_ALLOWED", "Eksekusi script dinonaktifkan (izin shell connector Coding & Files nonaktif).", { guidance: "Arahkan pengguna mengaktifkan izin shell di Connectors." });
        const root = await workspaceRoot(baseDir, run.userId);
        const profile = await detectProjectAt(root, args.path);
        if (!profile?.packageManager) throw new ToolResultError("DEPENDENCY_MISSING", "Tidak ada project JS/TS dengan package manager di folder ini. Gunakan general:execute_shell untuk project non-JS.");
        const scriptCmd = profile.scripts[args.script];
        if (!scriptCmd) throw new ToolResultError("VALIDATION_FAILED", `Script "${args.script}" tidak ada. Tersedia: ${Object.keys(profile.scripts).join(", ") || "-"}.`);
        const pmRun = profile.packageManager === "npm" ? ["npm", "run", args.script] : [profile.packageManager, "run", args.script];
        const cwd = await workspacePath(root, args.path);
        const result = await execCommand({ command: pmRun[0]!, args: pmRun.slice(1), cwd, timeoutMs: args.timeoutMs, signal, maxOutput: 12_000, label: args.script });
        return { script: args.script, command: scriptCmd, packageManager: profile.packageManager, ...result };
      } }),
  ];
}
