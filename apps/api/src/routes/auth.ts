import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import type { Database } from "../db";
import type { Logger } from "../lib/logger";
import { AppError } from "../lib/errors";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  loginWithPassword,
  revokeSession,
  revokeAllForAccount,
  verifySessionToken,
  ensureSeedAccount,
} from "../services/auth";
import { preferences } from "../db/schema";
import { requireAuth } from "../middleware/session";
import { createAuthProfileRoutes, profilePayload } from "./auth-profile";

const LoginSchema = z.object({
  identifier: z.string().min(1, "Username atau email wajib diisi").max(256),
  password: z.string().min(1, "Password wajib diisi").max(256),
});

function cookieSecure(c: { req: { url: string; header: (n: string) => string | undefined } }): boolean {
  try {
    const url = new URL(c.req.url);
    if (url.protocol === "https:") return true;
  } catch {
    /* ignore */
  }
  const forwarded = c.req.header("x-forwarded-proto");
  return forwarded?.split(",")[0]?.trim() === "https";
}

export function createAuthRoutes(deps: { db: Database; logger: Logger }) {
  const routes = new Hono<Env>();

  routes.post("/login", zValidator("json", LoginSchema), async (c) => {
    const input = c.req.valid("json");
    // Rate-limit key: client IP-ish + identifier bucket (Host header is loopback-only anyway).
    const fwd = c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip") ?? "local";
    const rateKey = `${fwd}|${input.identifier.trim().toLowerCase()}`;
    await ensureSeedAccount(deps.db, deps.logger);
    const account = await loginWithPassword(deps.db, input.identifier, input.password, rateKey);
    const { token, expiresAt } = await createSession(deps.db, account.id);
    const secure = cookieSecure(c);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      expires: expiresAt,
      secure,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return c.json({ profile: profilePayload(account) });
  });

  routes.get("/me", async (c) => {
    const token = getCookie(c, SESSION_COOKIE) ?? "";
    if (!token) throw new AppError("UNAUTHORIZED", "Belum login.", 401);
    const rec = await verifySessionToken(deps.db, token);
    if (!rec) throw new AppError("UNAUTHORIZED", "Session habis atau tidak valid.", 401);
    const [pref] = await deps.db.select().from(preferences).where(eq(preferences.accountId, rec.account.id)).limit(1);
    return c.json({
      profile: profilePayload(rec.account),
      preferences: pref
        ? { theme: pref.theme, sidebarCollapsed: !!pref.sidebarCollapsed, autoCompact: !!pref.autoCompact, compactThreshold: pref.compactThreshold }
        : null,
    });
  });

  routes.post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE) ?? "";
    if (token) {
      const rec = await verifySessionToken(deps.db, token).catch(() => null);
      if (rec) {
        await revokeSession(deps.db, rec.sessionId);
        // Controlled cleanup: mark this session's running agent runs as cancelled-requested
        // so background workers stop; transaction settlement still follows real outcome.
        try {
          const { agentRuns } = await import("../db/schema");
          const { eq: eqq, and: andd } = await import("drizzle-orm");
          await deps.db
            .update(agentRuns)
            .set({ cancelRequested: true })
            .where(andd(eqq(agentRuns.userId, rec.account.workspaceId), eqq(agentRuns.status, "running")));
        } catch {
          /* best-effort */
        }
      }
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  routes.route("/", createAuthProfileRoutes(deps));

  routes.post("/logout-all", async (c) => {
    const { account } = requireAuth(c as never);
    await revokeAllForAccount(deps.db, account.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  return routes;
}
