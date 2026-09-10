import { freemem, totalmem, cpus, hostname, networkInterfaces, platform as osPlatform, arch } from "node:os";
import { z } from "zod";
import { defineTool, objectSchema } from "../types";
import { execCommand } from "./exec-core";

const PROBE_COMMANDS = ["bun", "node", "npm", "pnpm", "yarn", "git", "python", "pip", "cargo", "go", "powershell", "sh", "tar", "curl"];

/** Info sistem read-only. Capability list TANPA env var/secret apa pun. */
export function createSystemTools(shellAvailable: boolean) {
  return [
    defineTool({ name: "system:platform", connector: "workspace", tags: ["system", "read", "platform"],
      description: "Info platform host: OS, arsitektur, hostname, jumlah CPU.",
      schema: z.object({}).strict(), parameters: objectSchema({}),
      execute: async () => ({ platform: osPlatform(), arch: arch(), hostname: hostname(), cpus: cpus().length, processCwd: process.cwd() }) }),
    defineTool({ name: "system:resources", connector: "workspace", tags: ["system", "read", "resources"],
      description: "Memori total/bebas host (pembacaan ringkas, bukan diagnosis realtime).",
      schema: z.object({}).strict(), parameters: objectSchema({}),
      execute: async () => ({ totalMemoryMB: Math.round(totalmem() / 1024 / 1024), freeMemoryMB: Math.round(freemem() / 1024 / 1024), cpuModel: cpus()[0]?.model ?? null, loadAvg: osPlatform() === "win32" ? null : (await import("node:os")).loadavg() }) }),
    defineTool({ name: "system:network_interfaces", connector: "workspace", tags: ["system", "read", "network"],
      description: "Daftar interface jaringan host (nama + alamat) untuk diagnosis konektivitas.",
      schema: z.object({}).strict(), parameters: objectSchema({}),
      execute: async () => {
        const ifaces = networkInterfaces();
        return Object.entries(ifaces).flatMap(([name, addrs]) => (addrs ?? []).map((a) => ({ name, family: a.family, address: a.address, internal: a.internal })));
      } }),
    defineTool({ name: "system:environment_capabilities", connector: "workspace", tags: ["system", "read", "capabilities"],
      description: "Daftar kapabilitas environment (command mana yang tersedia) — TIDAK menampilkan nilai env var/secret.",
      schema: z.object({}).strict(), parameters: objectSchema({}),
      execute: async () => {
        if (!shellAvailable) {
          return { platform: osPlatform(), shell: "powershell", commands: Object.fromEntries(PROBE_COMMANDS.map((c) => [c, false])), note: "Izin shell nonaktif — deteksi command tidak dijalankan." };
        }
        const probe = async (cmd: string): Promise<boolean> => {
          if (osPlatform() === "win32") {
            const r = await execCommand({ command: "powershell.exe", args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `if (Get-Command ${cmd} -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }`], cwd: process.cwd(), timeoutMs: 8000, maxOutput: 100 }).catch(() => null);
            return (r?.output.trim() ?? "no").includes("yes");
          }
          const r = await execCommand({ command: "/bin/sh", args: ["-c", `command -v ${cmd} >/dev/null 2>&1 && echo yes || echo no`], cwd: process.cwd(), timeoutMs: 8000, maxOutput: 100 }).catch(() => null);
          return (r?.output.trim() ?? "no").includes("yes");
        };
        const entries = await Promise.all(PROBE_COMMANDS.map(async (c) => [c, await probe(c)] as const));
        return { platform: osPlatform(), shell: osPlatform() === "win32" ? "powershell" : "sh", commands: Object.fromEntries(entries) };
      } }),
  ];
}
