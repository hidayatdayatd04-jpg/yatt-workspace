import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { visionSettings } from "../db/schema";
import { sealSecret, openSecret, type KeyRing } from "../lib/crypto";
import { AppError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import { PROVIDER_KINDS, type ProviderKind } from "./provider-settings-types";

/**
 * Per-workspace Vision provider settings: konfigurasi eksplisit model vision
 * (base URL + model + API key) yang dipakai pembaca gambar. API key disimpan
 * terenkripsi AES-256-GCM dengan keyRing yang sama dipakai kredensial router
 * dan provider AI; tidak pernah dikembalikan dalam bentuk plaintext.
 */
const AAD_ID = "vision";

export interface VisionProviderSecret {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function createVisionSettingsService(deps: { db: Database; keyRing: KeyRing; logger: Logger }) {
  async function getStatus(userId: string): Promise<{ configured: boolean; kind: string | null; baseUrl: string | null; model: string | null; updatedAt: string | null }> {
    const [row] = await deps.db.select().from(visionSettings).where(eq(visionSettings.userId, userId)).limit(1);
    return {
      configured: !!row,
      kind: row?.kind ?? null,
      baseUrl: row?.baseUrl ?? null,
      model: row?.model ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  /** Dipakai pembaca gambar — null bila belum dikonfigurasi. */
  async function getDecrypted(userId: string): Promise<VisionProviderSecret | null> {
    const [row] = await deps.db.select().from(visionSettings).where(eq(visionSettings.userId, userId)).limit(1);
    if (!row) return null;
    const apiKey = openSecret(
      deps.keyRing,
      { ciphertext: row.apiKeyCiphertext, nonce: row.apiKeyNonce, authTag: row.apiKeyAuthTag, keyVersion: row.keyVersion },
      userId,
      AAD_ID,
    );
    if (apiKey === null) {
      deps.logger.error("vision api key decrypt failed", { userId });
      return null;
    }
    return { kind: row.kind as ProviderKind, baseUrl: row.baseUrl, model: row.model, apiKey };
  }

  /** apiKey opsional: bila kosong, kunci yang tersimpan dipakai ulang. */
  async function save(userId: string, input: { kind: string; baseUrl: string; model: string; apiKey?: string }): Promise<{ configured: true; updatedAt: string }> {
    const kind = (PROVIDER_KINDS as readonly string[]).includes(input.kind) ? (input.kind as ProviderKind) : null;
    if (!kind) throw new AppError("VALIDATION_FAILED", "Jenis provider vision tidak dikenal.", 422);
    let baseUrl: URL;
    try {
      baseUrl = new URL(input.baseUrl.trim());
    } catch {
      throw new AppError("VALIDATION_FAILED", "Base URL vision tidak valid (harus URL lengkap).", 422);
    }
    const model = input.model.trim();
    if (!model || model.length > 255) throw new AppError("VALIDATION_FAILED", "Nama model vision wajib diisi (maks 255 karakter).", 422);

    const [existing] = await deps.db.select().from(visionSettings).where(eq(visionSettings.userId, userId)).limit(1);
    let sealed: ReturnType<typeof sealSecret>;
    if (input.apiKey !== undefined && input.apiKey !== "") {
      const trimmed = input.apiKey.trim();
      if (trimmed.length < 8 || trimmed.length > 256) {
        throw new AppError("VALIDATION_FAILED", "API key vision tidak valid (panjang tidak wajar).", 422);
      }
      sealed = sealSecret(deps.keyRing, trimmed, userId, AAD_ID);
    } else {
      if (!existing) throw new AppError("VALIDATION_FAILED", "API key vision wajib diisi saat konfigurasi pertama.", 422);
      sealed = { ciphertext: existing.apiKeyCiphertext, nonce: existing.apiKeyNonce, authTag: existing.apiKeyAuthTag, keyVersion: existing.keyVersion };
    }
    const now = new Date();
    await deps.db
      .insert(visionSettings)
      .values({
        userId,
        kind,
        baseUrl: baseUrl.toString(),
        model,
        apiKeyCiphertext: sealed.ciphertext,
        apiKeyNonce: sealed.nonce,
        apiKeyAuthTag: sealed.authTag,
        keyVersion: sealed.keyVersion,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: visionSettings.userId,
        set: { kind, baseUrl: baseUrl.toString(), model, apiKeyCiphertext: sealed.ciphertext, apiKeyNonce: sealed.nonce, apiKeyAuthTag: sealed.authTag, keyVersion: sealed.keyVersion, updatedAt: now },
      });
    return { configured: true, updatedAt: now.toISOString() };
  }

  async function remove(userId: string): Promise<void> {
    await deps.db.delete(visionSettings).where(eq(visionSettings.userId, userId));
  }

  return { getStatus, getDecrypted, save, remove };
}

export type VisionSettingsService = ReturnType<typeof createVisionSettingsService>;
