import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Env } from "../types";
import type { Database } from "../db";
import type { Logger } from "../lib/logger";
import { customConnectors } from "../db/schema";
import { requireWorkspace } from "../middleware/session";
import { AppError } from "../lib/errors";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  serverUrl: z.string().trim().url().max(1024).refine((u) => u.startsWith("https://") || u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1"), {
    message: "URL harus https, atau http://localhost untuk server lokal.",
  }),
}).strict();

function toDTO(row: typeof customConnectors.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    serverUrl: row.serverUrl,
    status: row.lastError ? "error" as const : row.lastCheckedAt ? "connected" as const : "unverified" as const,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Probe minimal: server MCP streamable merespons POST (apa pun statusnya = reachable). */
async function probeServer(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "probe", method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "yatt-agent", version: "0.1.0" } } }),
    });
    await res.body?.cancel();
    // Respons apa pun (termasuk 4xx validasi) = server ada. 404 = bukan endpoint MCP.
    if (res.status === 404) return "URL merespons 404 — pastikan path endpoint MCP benar (mis. https://host/mcp).";
    return null;
  } catch (err) {
    return err instanceof Error && err.name === "TimeoutError" ? "Server tidak merespons dalam 15 detik." : "Server tidak dapat dijangkau. Periksa URL dan koneksi.";
  }
}

export function createCustomConnectorRoutes(deps: { db: Database; logger: Logger }) {
  const routes = new Hono<Env>();

  routes.get("/", async (c) => {
    const { userId } = requireWorkspace(c);
    const rows = await deps.db.select().from(customConnectors).where(eq(customConnectors.userId, userId));
    return c.json({ connectors: rows.map(toDTO) });
  });

  routes.post("/", zValidator("json", CreateSchema), async (c) => {
    const { userId } = requireWorkspace(c);
    const input = c.req.valid("json");
    const existing = await deps.db.select().from(customConnectors).where(eq(customConnectors.userId, userId));
    if (existing.length >= 20) throw new AppError("VALIDATION_FAILED", "Maksimal 20 custom connector per akun.", 422);
    if (existing.some((r) => r.name.toLowerCase() === input.name.toLowerCase())) throw new AppError("VALIDATION_FAILED", "Nama connector sudah dipakai.", 422);
    const id = crypto.randomUUID();
    const error = await probeServer(input.serverUrl);
    await deps.db.insert(customConnectors).values({
      id, userId, name: input.name, serverUrl: input.serverUrl,
      lastCheckedAt: new Date(), lastError: error, updatedAt: new Date(),
    });
    const [row] = await deps.db.select().from(customConnectors).where(and(eq(customConnectors.userId, userId), eq(customConnectors.id, id))).limit(1);
    return c.json({ connector: toDTO(row!) }, 201);
  });

  routes.post("/:id/test", async (c) => {
    const { userId } = requireWorkspace(c);
    const [row] = await deps.db.select().from(customConnectors).where(and(eq(customConnectors.userId, userId), eq(customConnectors.id, c.req.param("id")))).limit(1);
    if (!row) throw new AppError("NOT_FOUND", "Custom connector tidak ditemukan.", 404);
    const error = await probeServer(row.serverUrl);
    await deps.db.update(customConnectors).set({ lastCheckedAt: new Date(), lastError: error, updatedAt: new Date() }).where(eq(customConnectors.id, row.id));
    if (error) throw new AppError("UPSTREAM_ERROR", error, 502);
    const [updated] = await deps.db.select().from(customConnectors).where(eq(customConnectors.id, row.id)).limit(1);
    return c.json({ connector: toDTO(updated!) });
  });

  routes.delete("/:id", async (c) => {
    const { userId } = requireWorkspace(c);
    await deps.db.delete(customConnectors).where(and(eq(customConnectors.userId, userId), eq(customConnectors.id, c.req.param("id"))));
    return c.json({ ok: true });
  });

  return routes;
}
