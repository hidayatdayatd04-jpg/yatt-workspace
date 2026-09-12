import { Hono } from "hono";
import { basename } from "node:path";
import { lstat, readFile } from "node:fs/promises";
import type { Env } from "../types";
import type { IntegrationService } from "../services/integrations";
import { requireWorkspace } from "../middleware/session";
import { workspacePath, workspaceRoot } from "../tools/general/files";
import { AppError } from "../lib/errors";

export function createWorkspaceRoutes(service: IntegrationService, dataDir: string) {
  const routes = new Hono<Env>();
  routes.get("/download", async (c) => {
    const userId = requireWorkspace(c).userId;
    await service.assertAllowed(userId, "workspace");
    const path = c.req.query("path");
    if (!path || path.length > 1000) throw new AppError("VALIDATION_FAILED", "Path file tidak valid.", 422);
    let file: string;
    try { file = await workspacePath(await workspaceRoot(dataDir, userId), path); }
    catch { throw new AppError("FORBIDDEN", "Path di luar workspace ditolak.", 403); }
    const stat = await lstat(file).catch(() => null);
    if (!stat?.isFile()) throw new AppError("NOT_FOUND", "File tidak ditemukan.", 404);
    if (stat.size > 25_000_000) throw new AppError("FILE_TOO_LARGE", "File terlalu besar untuk diunduh (maks 25 MB).", 413);
    return new Response(await readFile(file), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(basename(file))}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
  });
  return routes;
}
