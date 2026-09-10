import { visionProviders } from "../db/schema";
import { supportsVision } from "@shared/index";
import { AppError } from "../lib/errors";
import { assertModelName, parseModelsList } from "./provider-settings-helpers";
import type { ProviderKind } from "./provider-settings-types";

export interface VisionProviderDTO {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  models: string[];
  activeModel: string;
  enabled: boolean;
  hasKey: boolean;
  updatedAt: string;
}

/** Kandidat vision terurut untuk fallback saat baca gambar (model 1 gagal → berikutnya). */
export interface VisionCandidate {
  providerId: string;
  providerKind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
}

type Row = typeof visionProviders.$inferSelect;

export function toDTO(r: Row): VisionProviderDTO {
  return {
    id: r.id,
    kind: r.kind as ProviderKind,
    name: r.name,
    baseUrl: r.baseUrl,
    models: parseModelsList(r.models, r.activeModel),
    activeModel: r.activeModel,
    enabled: Boolean(r.enabled),
    hasKey: Boolean(r.apiKeyCiphertext),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Tolak model yang tidak mendukung input gambar — sebutkan yang ditolak. */
export function assertVisionModels(models: string[]): void {
  models.forEach(assertModelName);
  const rejected = models.filter((m) => !supportsVision(m));
  if (rejected.length > 0) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Model tidak mendukung gambar dan ditolak: ${rejected.join(", ")}. Pilih model vision (mis. gemini-2.0-flash, gpt-4o-mini, claude-3.5-sonnet).`,
      422,
    );
  }
}

export function buildModels(input: { models?: string[]; activeModel?: string; model?: string }): { models: string[]; activeModel: string } {
  let models = input.models?.map((m) => m.trim()).filter(Boolean) ?? [];
  if (models.length === 0) {
    const fallback = input.activeModel?.trim() || input.model?.trim() || "";
    if (fallback) models = [fallback];
  }
  if (models.length === 0) throw new AppError("VALIDATION_FAILED", "Minimal sertakan satu model vision.", 422);
  const activeModel = input.activeModel?.trim() || input.model?.trim() || models[0]!;
  if (!models.includes(activeModel)) models.unshift(activeModel);
  assertVisionModels(models);
  return { models, activeModel };
}

