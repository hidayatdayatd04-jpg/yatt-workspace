import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { GOOGLE_SCOPES } from "@shared/index";
import type { Env } from "../types";
import type { IntegrationService } from "../services/integrations";
import { requireWorkspace } from "../middleware/session";
import { AppError } from "../lib/errors";
import { boundedJson } from "../tools/integrations/http";
import { createPendingStore, resolveRedirectUri } from "./google-oauth-state";

const AuthUrlSchema = z.object({
  clientId: z.string().trim().max(512).optional(),
  clientSecret: z.string().trim().max(512).optional(),
  redirectUri: z.string().trim().url().max(1024).optional(),
}).strict();

export function createGoogleOAuthRoutes(service: IntegrationService, opts: { clientId?: string; clientSecret?: string; redirectUri?: string; appUrl?: string }) {
  const routes = new Hono<Env>();
  const pending = createPendingStore();

  routes.get("/config", (c) => c.json({
    hasEnvClient: !!opts.clientId && !!opts.clientSecret,
    redirectHint: opts.redirectUri || `${(opts.appUrl || "http://localhost:3000").replace(/\/+$/, "")}/api/integrations/google/callback`,
    scopes: [...GOOGLE_SCOPES],
  }));

  routes.get("/status", async (c) => {
    const { userId } = requireWorkspace(c);
    const account = await service.googleAccount(userId);
    const [drive, gmail, calendar, google] = await Promise.all([
      service.status(userId, "drive"),
      service.status(userId, "gmail"),
      service.status(userId, "calendar"),
      service.status(userId, "google"),
    ]);
    return c.json({ account, services: { drive, gmail, calendar, google } });
  });

  routes.post("/auth-url", zValidator("json", AuthUrlSchema), async (c) => {
    const { userId } = requireWorkspace(c);
    const body = c.req.valid("json");
    const clientId = body.clientId?.trim() || opts.clientId?.trim();
    const clientSecret = body.clientSecret?.trim() || opts.clientSecret?.trim();
    if (!clientId || !clientSecret) throw new AppError("VALIDATION_FAILED", "Isi OAuth Client ID dan Client Secret Google (buat di Google Cloud Console → Credentials → OAuth client ID).", 422);
    const redirectUri = resolveRedirectUri(body.redirectUri, opts.redirectUri, c.req.url, opts.appUrl);
    try { new URL(redirectUri); } catch { throw new AppError("VALIDATION_FAILED", "Redirect URI tidak valid.", 422); }
    const state = pending.issue({ userId, clientId, clientSecret, redirectUri });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: [...GOOGLE_SCOPES].join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    })}`;
    return c.json({ url, redirectUri });
  });

  routes.get("/callback", async (c) => {
    const code = c.req.query("code")?.trim();
    const state = c.req.query("state")?.trim();
    const err = c.req.query("error")?.trim();
    const base = state ? pending.peekOrigin(state) : "";
    const toConnectors = (params: string) => {
      try {
        const origin = base || new URL(c.req.url).origin;
        return c.redirect(`${origin.replace(/\/+$/, "")}/connectors?${params}`, 302);
      } catch {
        return c.redirect(`/connectors?${params}`, 302);
      }
    };
    if (err) return toConnectors(`google=error&message=${encodeURIComponent(err)}`);
    if (!code || !state) return toConnectors(`google=error&message=${encodeURIComponent("Callback Google tidak lengkap.")}`);
    const auth = pending.take(state);
    if (!auth) return toConnectors(`google=error&message=${encodeURIComponent("Sesi login kedaluwarsa. Ulangi dari Connectors.")}`);
    try {
      const token = await boundedJson("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: auth.clientId, client_secret: auth.clientSecret, redirect_uri: auth.redirectUri, grant_type: "authorization_code" }),
      }) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: unknown };
      if (typeof token.access_token !== "string") throw new Error("Google tidak mengembalikan access token.");
      const accessToken = token.access_token;
      const refreshToken = typeof token.refresh_token === "string" ? token.refresh_token : undefined;
      const expiresIn = typeof token.expires_in === "number" ? token.expires_in : undefined;
      const grantedScopes = typeof token.scope === "string" ? token.scope.split(" ") : [...GOOGLE_SCOPES];
      let accountEmail: string | undefined;
      try {
        const profile = await boundedJson("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } }) as { email?: unknown };
        if (typeof profile.email === "string" && profile.email.includes("@")) accountEmail = profile.email;
      } catch { /* abaikan */ }
      await service.saveGoogleTokens(auth.userId, { accessToken, expiryMs: typeof expiresIn === "number" ? Date.now() + expiresIn * 1000 : undefined, accountEmail, scopes: grantedScopes, clientId: auth.clientId, clientSecret: auth.clientSecret, refreshToken });
      if (!refreshToken) {
        try {
          const existing = await service.credentials(auth.userId, "google");
          if (existing.refreshToken && !existing.accessToken) {
            await service.updateGoogleAccessToken(auth.userId, accessToken, expiresIn);
          }
        } catch { /* abaikan */ }
      }
      const qp = new URLSearchParams({ google: "connected", ...(accountEmail ? { email: accountEmail } : {}) }).toString();
      return toConnectors(qp);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login Google gagal.";
      return toConnectors(`google=error&message=${encodeURIComponent(message.slice(0, 300))}`);
    }
  });

  routes.delete("/", async (c) => {
    const { userId } = requireWorkspace(c);
    await service.disconnectGoogle(userId);
    return c.json({ ok: true });
  });

  return routes;
}
