import { GOOGLE_SERVICES, type IntegrationKind } from "@shared/index";

function isGoogleService(kind: string): kind is Exclude<IntegrationKind, "mikrotik" | "workspace" | "google" | "telegram"> {
  return kind === "drive" || kind === "gmail" || kind === "calendar" || kind === "docs" || kind === "sheets" || kind === "slides";
}
import type { Database } from "../../db";
import { integrations } from "../../db/schema";
import { sealSecret, type KeyRing } from "../../lib/crypto";
import { AppError } from "../../lib/errors";
import { integrationWhere, readIntegrationSecret, selectIntegrationRow, type GoogleCreds, type IntegrationRow } from "./store";

/** Token OAuth dengan izin granular: tiap layanan memakai akun Google sendiri. */
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

  function sealCreds(tokens: GoogleCreds, userId: string, kind: string) {
    return sealSecret(keyRing, JSON.stringify({
      accessToken: tokens.accessToken, expiryMs: tokens.expiryMs,
      accountEmail: tokens.accountEmail, scopes: tokens.scopes,
      clientId: tokens.clientId, clientSecret: tokens.clientSecret,
      refreshToken: tokens.refreshToken,
    }), userId, `integration:${kind}`);
  }

  async function saveGoogleTokens(userId: string, tokens: GoogleCreds & { allowWrite?: boolean; allowSend?: boolean; targetService?: string }) {
    if (!tokens.accessToken && !(tokens.clientId && tokens.clientSecret && tokens.refreshToken)) {
      throw new AppError("VALIDATION_FAILED", "Token Google tidak lengkap.", 422);
    }
    const target = tokens.targetService;
    if (target && isGoogleService(target)) {
      const existing = await selectIntegrationRow(db, userId, target);
      const sealed = sealCreds(tokens, userId, target);
      const values = {
        enabled: true,
        allowWrite: existing?.allowWrite ?? (target === "gmail" ? false : true),
        allowSend: existing?.allowSend ?? (target === "gmail" ? true : false),
        allowShell: false,
        ...sealed,
        lastError: null,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(integrations).values({ userId, kind: target, ...values }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: values });
      return {
        connected: true,
        email: tokens.accountEmail ?? null,
        scopes: Array.isArray(tokens.scopes) ? (tokens.scopes as string[]) : [],
        expiryMs: typeof tokens.expiryMs === "number" ? tokens.expiryMs : null,
        enabled: true,
      };
    }
    const sealed = sealCreds(tokens, userId, "google");
    const googleValues = { enabled: true, allowWrite: tokens.allowWrite ?? true, allowSend: tokens.allowSend ?? true, allowShell: false, ...sealed, lastError: null, lastCheckedAt: new Date(), updatedAt: new Date() };
    await db.insert(integrations).values({ userId, kind: "google", ...googleValues }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: googleValues });
    return googleAccount(userId);
  }

  async function updateGoogleAccessToken(userId: string, accessToken: string, expiresInSec?: number, targetKind: IntegrationKind = "google") {
    const row = await selectIntegrationRow(db, userId, targetKind);
    if (!row?.ciphertext) return;
    const prev = readSecret(userId, targetKind, row) ?? {};
    const next = { ...prev, accessToken, ...(typeof expiresInSec === "number" ? { expiryMs: Date.now() + expiresInSec * 1000 } : {}) };
    const sealed = sealCreds(next as GoogleCreds, userId, targetKind);
    await db.update(integrations).set({ ...sealed, updatedAt: new Date() }).where(integrationWhere(userId, targetKind));
  }

  async function disconnectGoogle(userId: string, targetKind?: IntegrationKind) {
    const clearFields = { enabled: false, ciphertext: null, nonce: null, authTag: null, lastCheckedAt: null, lastError: null, updatedAt: new Date() };
    if (targetKind && targetKind !== "google") {
      await db.update(integrations).set(clearFields).where(integrationWhere(userId, targetKind));
      return;
    }
    await db.insert(integrations).values({ userId, kind: "google", enabled: false }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: { ...clearFields, allowWrite: false, allowSend: false, allowShell: false } });
    for (const svc of GOOGLE_SERVICES) {
      await db.update(integrations).set(clearFields).where(integrationWhere(userId, svc));
    }
  }

  return { googleAccount, saveGoogleTokens, updateGoogleAccessToken, disconnectGoogle };
}
