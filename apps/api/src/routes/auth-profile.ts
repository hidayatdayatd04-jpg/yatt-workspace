import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import type { Database } from "../db";
import type { Logger } from "../lib/logger";
import { AppError } from "../lib/errors";
import { accounts } from "../db/schema";
import { requireAuth } from "../middleware/session";
import { SESSION_COOKIE, changePassword, revokeAllForAccount, updateIdentity } from "../services/auth";

/** Bentuk profil yang aman dikirim ke browser (tanpa hash/kredensial). */
export function profilePayload(a: { id: string; username: string; email: string | null; displayName: string; loginAlias: string | null }) {
  return { id: a.id, username: a.username, email: a.email, displayName: a.displayName, loginAlias: a.loginAlias };
}

const ProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  username: z.string().min(1).max(64).optional(),
  email: z.string().max(254).nullable().optional(),
});

const PasswordSchema = z.object({
  oldPassword: z.string().min(1).max(256).optional(),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter").max(256),
});

export function createAuthProfileRoutes(deps: { db: Database; logger: Logger }) {
  const routes = new Hono<Env>();

  routes.patch("/profile", zValidator("json", ProfileSchema), async (c) => {
    const { account } = requireAuth(c as never);
    const input = c.req.valid("json");
    if (input.username !== undefined || input.email !== undefined) {
      await updateIdentity(deps.db, account.id, { username: input.username, email: input.email });
    }
    if (input.displayName !== undefined) {
      const name = input.displayName.trim();
      if (!name) throw new AppError("VALIDATION_FAILED", "Display name tidak boleh kosong.", 422);
      await deps.db.update(accounts).set({ displayName: name, updatedAt: new Date() }).where(eq(accounts.id, account.id));
    }
    const [row] = await deps.db.select().from(accounts).where(eq(accounts.id, account.id)).limit(1);
    if (!row) throw new AppError("UNAUTHORIZED", "Session tidak valid.", 401);
    deps.logger.info("profile updated", { accountId: account.id });
    return c.json({ profile: profilePayload(row) });
  });

  routes.post("/password", zValidator("json", PasswordSchema), async (c) => {
    const { account } = requireAuth(c as never);
    const input = c.req.valid("json");
    await changePassword(deps.db, account.id, input.oldPassword ?? null, input.newPassword);
    // Logout total: semua sesi (termasuk sesi saat ini) dicabut setelah ganti password.
    await revokeAllForAccount(deps.db, account.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    deps.logger.info("password changed", { accountId: account.id });
    return c.json({ ok: true });
  });

  return routes;
}