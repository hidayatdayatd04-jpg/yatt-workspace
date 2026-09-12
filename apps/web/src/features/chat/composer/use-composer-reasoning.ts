import { useEffect, useState } from "react";
import {
  normalizeReasoningEffort,
  supportsReasoning,
  type ReasoningEffort,
} from "@shared/index";

const STORAGE_KEY = "composer-reasoning-effort";
/** Kunci localStorage pilihan reasoning — dipakai ulang oleh retry pesan. */
export const REASONING_STORAGE_KEY = STORAGE_KEY;

/** Nilai yang dikirim ke server: upaya penalaran, atau "off" = matikan. */
export type ComposerEffort = ReasoningEffort | "off";

/**
 * Pilihan reasoning_effort per composer. Tersimpan di localStorage ("off"
 * disimpan eksplisit agar pilihan "Mati" bertahan, beda dari belum memilih)
 * untuk semua model: server memilih reasoning native atau thinking custom.
 */
export function useComposerReasoning(effectiveModel: string) {
  const [effort, setEffortState] = useState<ComposerEffort | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "off") return "off";
      return normalizeReasoningEffort(raw) ?? null;
    } catch {
      return null;
    }
  });

  const nativeSupported = supportsReasoning(effectiveModel);

  // Preferensi native tidak mematikan thinking custom saat pindah model biasa.
  const activeEffort: ComposerEffort | undefined = nativeSupported ? effort ?? "medium" : undefined;

  function setEffort(next: ComposerEffort | null) {
    setEffortState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // Bersihkan nilai basi bila suatu saat tersimpan nilai tak valid.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null && raw !== "off" && normalizeReasoningEffort(raw) === undefined) localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { effort: activeEffort, storedEffort: effort, setEffort, nativeSupported };
}

export type ComposerReasoning = ReturnType<typeof useComposerReasoning>;
