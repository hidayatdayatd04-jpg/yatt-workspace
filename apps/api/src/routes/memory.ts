import { Hono } from "hono";
import type { Env as HonoEnv } from "../types";
import { AppError } from "../lib/errors";
import type { Database } from "../db";
import { clearMemories, deleteMemory, listMemories } from "../services/user-memory";

export function createMemoryRoutes(deps: { db: Database }) {
  const app = new Hono<HonoEnv>();

  app.get("/", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    return c.json({ memories: await listMemories(deps.db, workspace.userId) });
  });

  app.delete("/:id", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    const ok = await deleteMemory(deps.db, workspace.userId, c.req.param("id"));
    if (!ok) throw new AppError("NOT_FOUND", "Memori tidak ditemukan.", 404);
    return c.json({ deleted: true });
  });

  app.delete("/", async (c) => {
    const workspace = c.get("workspace");
    if (!workspace) throw new AppError("UNAUTHORIZED", "Login diperlukan.", 401);
    const removed = await clearMemories(deps.db, workspace.userId);
    return c.json({ removed });
  });

  return app;
}
