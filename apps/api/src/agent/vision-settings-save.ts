import { and, eq } from "drizzle-orm";
import { visionProviders } from "../db/schema";
import { sealSecret } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { assertUrl, defaultBaseUrl, defaultProviderName } from "./provider-settings-helpers";
import { PROVIDER_KINDS, type ProviderSettingsDeps, type SaveProviderInput } from "./provider-settings-types";
import { buildModels, toDTO } from "./vision-settings-utils";

export async function saveVisionProvider(deps: ProviderSettingsDeps, userId: string, input: SaveProviderInput) {
  if (!PROVIDER_KINDS.includes(input.kind)) throw new AppError("VALIDATION_FAILED", "Jenis provider vision tidak valid.", 422);
  const id = input.id?.trim() || crypto.randomUUID();
  const [existing] = await deps.db.select().from(visionProviders).where(eq(visionProviders.id, id)).limit(1);
  if (existing && existing.userId !== userId) throw new AppError("NOT_FOUND", "Provider vision tidak ditemukan.", 404);
  const baseUrl = (input.baseUrl?.trim() || defaultBaseUrl(input.kind)).replace(/\/+$/, "");
  assertUrl(baseUrl);
  const { models, activeModel } = buildModels(input);
  const apiKey = input.apiKey?.trim();
  if (!apiKey && (!existing || existing.kind !== input.kind || existing.baseUrl !== baseUrl)) {
    throw new AppError("VALIDATION_FAILED", "Isi API key untuk provider baru atau perubahan endpoint.", 422);
  }
  if (apiKey && apiKey.length < 8) throw new AppError("VALIDATION_FAILED", "API key minimal 8 karakter.", 422);
  const sealed = apiKey ? sealSecret(deps.keyRing, apiKey, userId, "vision") : {
    ciphertext: existing!.apiKeyCiphertext, nonce: existing!.apiKeyNonce,
    authTag: existing!.apiKeyAuthTag, keyVersion: existing!.keyVersion,
  };
  const values = { kind: input.kind, name: input.name?.trim() || defaultProviderName(input.kind), baseUrl,
    models: [...new Set(models)], activeModel, enabled: input.enabled ?? existing?.enabled ?? true,
    apiKeyCiphertext: sealed.ciphertext, apiKeyNonce: sealed.nonce, apiKeyAuthTag: sealed.authTag,
    keyVersion: sealed.keyVersion, updatedAt: new Date() };
  if (existing) {
    await deps.db.update(visionProviders).set(values).where(and(eq(visionProviders.id, id), eq(visionProviders.userId, userId)));
  } else {
    await deps.db.insert(visionProviders).values({ ...values, id, userId });
  }
  return toDTO({ ...values, id, userId, createdAt: existing?.createdAt ?? new Date() });
}
