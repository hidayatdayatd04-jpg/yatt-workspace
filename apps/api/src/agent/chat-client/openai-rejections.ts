/** Klasifikasi penolakan parameter 400 oleh provider (untuk fallback berlapis). */

type Rejectable = { status?: number; message?: string; error?: { message?: string } } | null;

function rejectionMessage(err: unknown): { status: number; msg: string } {
  const e = err as Rejectable;
  const status = typeof e?.status === "number" ? e.status : 0;
  const msg = String(e?.error?.message ?? e?.message ?? (err instanceof Error ? err.message : ""));
  return { status, msg };
}

/** 400 yang menyebut temperature = model menolak parameter tersebut. */
export function isTemperatureRejection(err: unknown): boolean {
  const { status, msg } = rejectionMessage(err);
  return (status === 400 || /invalid[ _-]?argument/i.test(msg)) && /temperature/i.test(msg);
}

/** 400 yang menyebut reasoning_effort/reasoning = model menolak parameter reasoning. */
export function isReasoningRejection(err: unknown): boolean {
  const { status, msg } = rejectionMessage(err);
  return (status === 400 || /invalid[ _-]?argument/i.test(msg) || /unsupported/i.test(msg)) && /reasoning/i.test(msg);
}

/** 400 yang menyebut max_tokens = model reasoning baru minta max_completion_tokens. */
export function isMaxTokensRejection(err: unknown): boolean {
  const { status, msg } = rejectionMessage(err);
  return status === 400 && /max_tokens|max_completion_tokens/i.test(msg);
}
