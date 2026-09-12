import { normalizeReasoningEffort, supportsReasoning } from "@shared/index";

/** "Mati" berlaku untuk semua model; parameter provider khusus model native. */
export function resolveRunThinking(model: string, requested: unknown) {
  const native = supportsReasoning(model);
  const disabled = requested === "off";
  const reasoningEffort = native && !disabled
    ? normalizeReasoningEffort(requested) ?? "medium"
    : undefined;
  return {
    reasoningEffort,
    customThinking: !native && !disabled,
  };
}

// Kapabilitas mengikuti model efektif pada awal run, sama dengan pemilihan
// provider. Model tanpa metadata native memakai protokol teks di prompt.
