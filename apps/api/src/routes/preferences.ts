import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import type { Database } from "../db";
import type { Logger } from "../lib/logger";
import { preferences } from "../db/schema";
import { requireAuth } from "../middleware/session";

const SaveSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  sidebarCollapsed: z.boolean().optional(),
  autoCompact: z.boolean().optional(),
  compactThreshold: z.number().int().min(50).max(95).optional(),
  aiInstructions: z.string().max(2000).optional(),
});

export function createPreferencesRoutes(deps: { db: Database; logger: Logger }) {
  const routes = new Hono<Env>();
  routes.get("/", async (c) => {
    const { account } = requireAuth(c as never);
    const [row] = await deps.db.select().from(preferences).where(eq(preferences.accountId, account.id)).limit(1);
    if (!row) {
      await deps.db.insert(preferences).values({ accountId: account.id }).onConflictDoNothing();
      return c.json({ preferences: { theme: "system", sidebarCollapsed: false, autoCompact: true, compactThreshold: 80, aiInstructions: "" } });
    }
    return c.json({
      preferences: {
        theme: row.theme,
        sidebarCollapsed: !!row.sidebarCollapsed,
        autoCompact: !!row.autoCompact,
        compactThreshold: row.compactThreshold,
        aiInstructions: (row as { aiInstructions?: string }).aiInstructions ?? "",
      },
    });
  });
  routes.patch("/", zValidator("json", SaveSchema), async (c) => {
    const { account } = requireAuth(c as never);
    const input = c.req.valid("json");
    await deps.db.insert(preferences).values({ accountId: account.id }).onConflictDoNothing();
    await deps.db
      .update(preferences)
      .set({
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.sidebarCollapsed !== undefined ? { sidebarCollapsed: input.sidebarCollapsed } : {}),
        ...(input.autoCompact !== undefined ? { autoCompact: input.autoCompact } : {}),
        ...(input.compactThreshold !== undefined ? { compactThreshold: input.compactThreshold } : {}),
        ...(input.aiInstructions !== undefined ? { aiInstructions: input.aiInstructions.slice(0, 2000) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(preferences.accountId, account.id));
    const [row] = await deps.db.select().from(preferences).where(eq(preferences.accountId, account.id)).limit(1);
    return c.json({
      preferences: {
        theme: row!.theme,
        sidebarCollapsed: !!row!.sidebarCollapsed,
        autoCompact: !!row!.autoCompact,
        compactThreshold: row!.compactThreshold,
        aiInstructions: (row as unknown as { aiInstructions?: string })!.aiInstructions ?? "",
      },
    });
  });
  return routes;
}
