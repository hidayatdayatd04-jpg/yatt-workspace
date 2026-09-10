import type { MiddlewareHandler } from "hono";
import { AppError } from "../lib/errors";

/** Loopback binding plus Host/Origin checks block remote sites and DNS rebinding. */
export function localOnly(port: number, development = false): MiddlewareHandler {
  const hosts = new Set([
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    `[::1]:${port}`,
    "localhost",
    "127.0.0.1",
    "[::1]",
  ]);
  const origins = new Set([...hosts].map((host) => `http://${host}`));
  if (development) {
    hosts.add("localhost:3000");
    hosts.add("127.0.0.1:3000");
    hosts.add("[::1]:3000");
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://[::1]:3000");
  }
  if (process.env.APP_URL) {
    try {
      const u = new URL(process.env.APP_URL);
      hosts.add(u.host);
      origins.add(u.origin);
    } catch {
      /* abaikan url tidak valid */
    }
  }
  return async (c, next) => {
    const host = c.req.header("host") ?? new URL(c.req.url).host;
    const origin = c.req.header("origin");
    const site = c.req.header("sec-fetch-site");
    const isOAuthCallback = c.req.path.startsWith("/api/integrations/google/callback");
    if (!hosts.has(host) || (!isOAuthCallback && ((origin !== undefined && !origins.has(origin)) || site === "cross-site"))) {
      throw new AppError("FORBIDDEN", "API hanya dapat diakses aplikasi lokal.", 403);
    }
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  };
}

