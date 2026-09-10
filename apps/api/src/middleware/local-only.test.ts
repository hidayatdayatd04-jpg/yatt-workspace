import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { localOnly } from "./local-only";
import { AppError, errorBody, statusForCode } from "../lib/errors";

function createTestApp() {
  const app = new Hono();
  app.use("*", localOnly(3001, true));
  app.onError((err, c) => {
    const status = err instanceof AppError ? statusForCode(err.code) : 500;
    return c.json(errorBody(c, err), status as 403);
  });
  app.get("/api/ping", (c) => c.json({ ok: true }));
  app.get("/api/integrations/google/callback", (c) => c.json({ ok: true, callback: true }));
  return app;
}

describe("localOnly middleware", () => {
  it("allows requests from localhost:3000 and 127.0.0.1:3001", async () => {
    const app = createTestApp();
    const res1 = await app.request("http://localhost:3000/api/ping", {
      headers: { host: "localhost:3000" },
    });
    expect(res1.status).toBe(200);

    const res2 = await app.request("http://127.0.0.1:3001/api/ping", {
      headers: { host: "127.0.0.1:3001" },
    });
    expect(res2.status).toBe(200);
  });

  it("blocks cross-site requests to ordinary API endpoints", async () => {
    const app = createTestApp();
    const res = await app.request("http://localhost:3000/api/ping", {
      headers: {
        host: "localhost:3000",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  it("allows cross-site redirect callback to /api/integrations/google/callback", async () => {
    const app = createTestApp();
    const res = await app.request("http://localhost:3000/api/integrations/google/callback?code=abc&state=123", {
      headers: {
        host: "localhost:3000",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; callback?: boolean };
    expect(body.ok).toBe(true);
    expect(body.callback).toBe(true);
  });

  it("blocks requests with untrusted host header", async () => {
    const app = createTestApp();
    const res = await app.request("http://evil.com/api/ping", {
      headers: { host: "evil.com" },
    });
    expect(res.status).toBe(403);
  });
});
