import { and, asc, eq } from "drizzle-orm";
import { visionProviders } from "../db/schema";
import { openSecret } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { supportsVision } from "@shared/index";
import { parseModelsList } from "./provider-settings-helpers";
import type { ProviderKind, ProviderSettingsDeps, SaveProviderInput } from "./provider-settings-types";
import { assertVisionModels, toDTO, type VisionCandidate } from "./vision-settings-utils";
import { saveVisionProvider } from "./vision-settings-save";

export function createVisionSettingsService(deps: ProviderSettingsDeps) {
  const scope = (userId: string, id: string) => and(eq(visionProviders.userId, userId), eq(visionProviders.id, id));
  async function list(userId: string) {
    const rows = await deps.db.select().from(visionProviders).where(eq(visionProviders.userId, userId))
      .orderBy(asc(visionProviders.createdAt), asc(visionProviders.id));
    return rows.map(toDTO);
  }
  async function get(userId: string, id: string) {
    const [row] = await deps.db.select().from(visionProviders).where(scope(userId, id)).limit(1);
    return row ? toDTO(row) : null;
  }
  async function requireProvider(userId: string, id: string) {
    const row = await get(userId, id);
    if (!row) throw new AppError("NOT_FOUND", "Provider vision tidak ditemukan.", 404);
    return row;
  }
  async function getSavedKey(userId: string, id: string) {
    const [row] = await deps.db.select().from(visionProviders).where(scope(userId, id)).limit(1);
    if (!row) return null;
    const apiKey = openSecret(deps.keyRing, { ciphertext: row.apiKeyCiphertext, nonce: row.apiKeyNonce,
      authTag: row.apiKeyAuthTag, keyVersion: row.keyVersion }, userId, "vision");
    if (apiKey === null) throw new AppError("INTERNAL_ERROR", "Dekripsi API key vision gagal.", 500);
    return { kind: row.kind as ProviderKind, baseUrl: row.baseUrl, apiKey };
  }
  async function listVisionCandidates(userId: string): Promise<VisionCandidate[]> {
    const out: VisionCandidate[] = [];
    for (const row of await list(userId)) {
      if (!row.enabled) continue;
      const opened = await getSavedKey(userId, row.id).catch(() => null);
      if (!opened?.apiKey) continue;
      const models = [row.activeModel, ...parseModelsList(row.models, row.activeModel)];
      for (const model of new Set(models)) {
        if (supportsVision(model)) out.push({ providerId: row.id, providerKind: row.kind,
          baseUrl: row.baseUrl, model, apiKey: opened.apiKey });
      }
    }
    return out;
  }
  async function toggle(userId: string, id: string, enabled: boolean) {
    await requireProvider(userId, id);
    await deps.db.update(visionProviders).set({ enabled, updatedAt: new Date() }).where(scope(userId, id));
    return requireProvider(userId, id);
  }
  async function setActiveModel(userId: string, id: string, model: string) {
    const row = await requireProvider(userId, id);
    assertVisionModels([model]);
    if (!row.models.includes(model)) throw new AppError("VALIDATION_FAILED", "Model belum terdaftar pada provider vision.", 422);
    await deps.db.update(visionProviders).set({ activeModel: model, updatedAt: new Date() }).where(scope(userId, id));
    return requireProvider(userId, id);
  }
  async function remove(userId: string, id?: string) {
    await deps.db.delete(visionProviders).where(id ? scope(userId, id) : eq(visionProviders.userId, userId));
  }
  return { list, get, getSavedKey, listVisionCandidates, toggle, setActiveModel, remove,
    save: (userId: string, input: SaveProviderInput) => saveVisionProvider(deps, userId, input) };
}
export type VisionSettingsService = ReturnType<typeof createVisionSettingsService>;
