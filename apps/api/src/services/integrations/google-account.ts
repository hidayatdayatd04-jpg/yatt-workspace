import { GOOGLE_SERVICES, type IntegrationKind } from "@shared/index";
import type { Database } from "../../db";
import { integrations } from "../../db/schema";
import { sealSecret, type KeyRing } from "../../lib/crypto";
import { AppError } from "../../lib/errors";
import { integrationWhere, readIntegrationSecret, selectIntegrationRow, type GoogleCreds, type IntegrationRow } from "./store";

/** Token OAuth pusat: satu login mengaktifkan Drive+Gmail+Calendar. */
export function createGoogleAccountStore(deps: { db: Database; keyRing: KeyRing }) {
  const { db, keyRing } = deps;
  const googleRow = (userId: string) => selectIntegrationRow(db, userId, "google");
  const readSecret = (userId: string, kind: IntegrationKind, r: IntegrationRow) => readIntegrationSecret(keyRing, userId, kind, r);

  async function googleAccount(userId: string) {
    const r = await googleRow(userId);
    const creds = readSecret(userId, "google", r);
    const connected = !!creds && (!!creds.accessToken || !!(creds.clientId && creds.clientSecret && creds.refreshToken));
    return {
      connected,
      email: creds?.accountEmail ?? null,
      scopes: Array.isArray(creds?.scopes) ? (creds.scopes as string[]) : [],
      expiryMs: typeof creds?.expiryMs === "number" ? creds.expiryMs : null,
      enabled: !!r?.enabled,
    };
  }

  async function saveGoogleTokens(userId: string, tokens: GoogleCreds & { allowWrite?: boolean; allowSend?: boolean }) {
    if (!tokens.accessToken && !(tokens.clientId && tokens.clientSecret && tokens.refreshToken)) throw new AppError("VALIDATION_FAILED", "Token Google tidak lengkap.", 422);
    const sealed = sealSecret(keyRing, JSON.stringify({ accessToken: tokens.accessToken, expiryMs: tokens.expiryMs, accountEmail: tokens.accountEmail, scopes: tokens.scopes, clientId: tokens.clientId, clientSecret: tokens.clientSecret, refreshToken: tokens.refreshToken }), userId, "integration:google");
    const googleValues = { enabled: true, allowWrite: tokens.allowWrite ?? true, allowSend: tokens.allowSend ?? true, allowShell: false, ...sealed, lastError: null, lastCheckedAt: new Date(), updatedAt: new Date() };
    await db.insert(integrations).values({ userId, kind: "google", ...googleValues }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: googleValues });
    for (const svc of GOOGLE_SERVICES) {
      const existing = await selectIntegrationRow(db, userId, svc);
      const values = { enabled: true, allowWrite: existing?.allowWrite ?? (svc === "gmail" ? false : true), allowSend: existing?.allowSend ?? svc === "gmail", allowShell: false, lastError: null, lastCheckedAt: new Date(), updatedAt: new Date() };
      await db.insert(integrations).values({ userId, kind: svc, ...values }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: values });
    }
    return googleAccount(userId);
  }

  async function updateGoogleAccessToken(userId: string, accessToken: string, expiresInSec?: number) {
    const prev = readSecret(userId, "google", await googleRow(userId)) ?? {};
    const next = { ...prev, accessToken, ...(typeof expiresInSec === "number" ? { expiryMs: Date.now() + expiresInSec * 1000 } : {}) };
    const sealed = sealSecret(keyRing, JSON.stringify(next), userId, "integration:google");
    await db.update(integrations).set({ ...sealed, updatedAt: new Date() }).where(integrationWhere(userId, "google"));
  }

  async function disconnectGoogle(userId: string) {
    await db.insert(integrations).values({ userId, kind: "google", enabled: false }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: { enabled: false, allowWrite: false, allowSend: false, allowShell: false, ciphertext: null, nonce: null, authTag: null, lastCheckedAt: null, lastError: null, updatedAt: new Date() } });
    for (const svc of GOOGLE_SERVICES) {
      await db.update(integrations).set({ lastCheckedAt: null, lastError: null, updatedAt: new Date() }).where(integrationWhere(userId, svc));
    }
  }

  return { googleAccount, saveGoogleTokens, updateGoogleAccessToken, disconnectGoogle };
}
