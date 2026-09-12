import { GOOGLE_SERVICES, INTEGRATION_CATALOG, IntegrationSettingsSchema, type IntegrationDTO, type IntegrationKind, type IntegrationSettings } from "@shared/index";
import type { Database } from "../db";
import { integrations } from "../db/schema";
import { sealSecret, type KeyRing } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { integrationWhere, readIntegrationSecret, selectIntegrationRow, type GoogleCreds, type IntegrationRow } from "./integrations/store";
import { createGoogleAccountStore } from "./integrations/google-account";

const GOOGLE_SERVICE_SET = new Set<IntegrationKind>([...GOOGLE_SERVICES, "google"]);
function isGoogleService(kind: IntegrationKind) {
  return kind === "drive" || kind === "gmail" || kind === "calendar" || kind === "docs" || kind === "sheets" || kind === "slides";
}

export function createIntegrationService(deps: { db: Database; keyRing: KeyRing }) {
  const row = (userId: string, kind: IntegrationKind) => selectIntegrationRow(deps.db, userId, kind);
  const readSecret = (userId: string, kind: IntegrationKind, r: IntegrationRow) => readIntegrationSecret(deps.keyRing, userId, kind, r);
  const googleRow = (userId: string) => row(userId, "google");
  const google = createGoogleAccountStore(deps);

  async function googleCredsOrNull(userId: string): Promise<GoogleCreds | null> {
    return readSecret(userId, "google", await googleRow(userId));
  }

  async function status(userId: string, kind: IntegrationKind): Promise<IntegrationDTO> {
    const r = await row(userId, kind);
    // Workspace = tools default agent: aktif bila belum pernah diatur.
    if (kind === "workspace") {
      return { kind, enabled: r?.enabled ?? true, configured: true, allowWrite: r?.allowWrite ?? true, allowSend: false, allowShell: r?.allowShell ?? false,
        status: r?.lastError ? "error" : "ready", accountEmail: null,
        lastCheckedAt: r?.lastCheckedAt?.toISOString() ?? null, lastError: r?.lastError ?? null };
    }
    const creds = r?.ciphertext ? readSecret(userId, kind, r) : null;
    const configured = kind === "mikrotik" || !!(creds && (creds.accessToken || (creds.clientId && creds.refreshToken) || creds.botToken));
    const enabled = r?.enabled ?? false;
    return { kind, enabled, configured, allowWrite: r?.allowWrite ?? false, allowSend: r?.allowSend ?? false, allowShell: false,
      status: !enabled ? "disabled" : r?.lastError ? "error" : r?.lastCheckedAt ? "connected" : configured && kind === "mikrotik" ? "ready" : "unverified",
      accountEmail: creds?.accountEmail ?? null,
      lastCheckedAt: r?.lastCheckedAt?.toISOString() ?? null, lastError: r?.lastError ?? null };
  }

  async function credentials(userId: string, kind: IntegrationKind): Promise<GoogleCreds> {
    const own = readSecret(userId, kind, await row(userId, kind));
    if (own && (own.accessToken || (own.clientId && own.clientSecret && own.refreshToken))) return own;
    if (kind === "google") {
      const shared = readSecret(userId, "google", await googleRow(userId));
      if (shared && (shared.accessToken || (shared.clientId && shared.clientSecret && shared.refreshToken))) return shared;
    }
    if (own) return own;
    throw new AppError("PROVIDER_NOT_CONFIGURED", `Hubungkan connector ${kind} di halaman Connectors.`, 400);
  }

  function validateGoogleCreds(kind: IntegrationKind, next: GoogleCreds) {
    if (kind === "telegram") {
      if (!/^\d+:[A-Za-z0-9_-]+$/.test(next.botToken ?? "")) throw new AppError("VALIDATION_FAILED", "Bot token Telegram tidak valid.", 422);
      return;
    }
    if (GOOGLE_SERVICE_SET.has(kind) && !next.accessToken && !(next.clientId && next.clientSecret && next.refreshToken)) {
      throw new AppError("VALIDATION_FAILED", "Hubungkan via Login Google atau isi access token / OAuth client + refresh token.", 422);
    }
  }

  async function save(userId: string, kind: IntegrationKind, value: IntegrationSettings) {
    const input = IntegrationSettingsSchema.parse(value);
    const current = await row(userId, kind);
    const suppliedRaw = input.credentials ?? {};
    const supplied = Object.fromEntries(Object.entries(suppliedRaw).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)));
    let secretFields = {};
    if (Object.keys(supplied).length) {
      const previous = current?.ciphertext ? (readSecret(userId, kind, current) ?? {}) : {};
      const next = { ...previous, ...supplied } as GoogleCreds;
      validateGoogleCreds(kind, next);
      secretFields = sealSecret(deps.keyRing, JSON.stringify(next), userId, `integration:${kind}`);
    } else if (current?.ciphertext && isGoogleService(kind)) {
      const existing = readSecret(userId, kind, current);
      if (existing && (existing.accessToken || existing.refreshToken || existing.botToken)) validateGoogleCreds(kind, existing);
    }
    const values = { enabled: input.enabled, allowWrite: input.allowWrite, allowSend: input.allowSend, allowShell: kind === "workspace" && input.allowShell, ...secretFields, lastError: null, lastCheckedAt: null, updatedAt: new Date() };
    await deps.db.insert(integrations).values({ userId, kind, ...values }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: values });
    return status(userId, kind);
  }

  async function assertAllowed(userId: string, kind: IntegrationKind, permission: "read" | "write" | "send" | "shell" = "read") {
    const s = await status(userId, kind);
    if (!s.enabled) throw new AppError("FORBIDDEN", `Connector ${kind} nonaktif. Aktifkan di Connectors atau menu chat.`, 403);
    if (!s.configured) throw new AppError("PROVIDER_NOT_CONFIGURED", isGoogleService(kind) ? `Izin akun Google untuk ${kind} belum aktif. Hubungkan ${kind} di halaman Connectors.` : "Connector belum dikonfigurasi di halaman Connectors.", 400);
    if ((permission === "write" && !s.allowWrite) || (permission === "send" && !s.allowSend) || (permission === "shell" && !s.allowShell)) throw new AppError("FORBIDDEN", "Izin tindakan ini belum aktif di halaman Connectors.", 403);
    return s;
  }

  async function markChecked(userId: string, kind: IntegrationKind, error: string | null) {
    await deps.db.update(integrations).set({ lastCheckedAt: new Date(), lastError: error }).where(integrationWhere(userId, kind));
  }

  return { status, credentials, save, assertAllowed, markChecked, ...google, googleCredsOrNull,
    list: (userId: string) => Promise.all(INTEGRATION_CATALOG.map((x) => status(userId, x.kind))),
    remove: async (userId: string, kind: IntegrationKind) => {
      if (kind === "google") { await google.disconnectGoogle(userId); return; }
      if (isGoogleService(kind)) { await google.disconnectGoogle(userId, kind); }
      await deps.db.insert(integrations).values({ userId, kind, enabled: false }).onConflictDoUpdate({ target: [integrations.userId, integrations.kind], set: { enabled: false, allowWrite: false, allowSend: false, allowShell: false, ciphertext: null, nonce: null, authTag: null, lastCheckedAt: null, lastError: null, updatedAt: new Date() } });
    },
  };
}
export type IntegrationService = ReturnType<typeof createIntegrationService>;
