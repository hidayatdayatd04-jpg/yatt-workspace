const SENSITIVE_KEY =
  /(?:[\w-]*(?:password|passwd|passphrase|secret|token|key|psk|credential|authorization|cookie)s?)/i.source;

const SENSITIVE_PAIR_RE = new RegExp(
  `("?${SENSITIVE_KEY}"?\\s*[:=]\\s*)((?:"(?:\\\\.|[^"\\\\])*")|(?:'(?:\\\\.|[^'\\\\])*')|[^\\s,;}\\]]+)`,
  "gi",
);

/** Redaction sisi klien — mirror redactText server; defense in depth untuk detail tool. */
export function redactSecrets(text: string): string {
  let out = text.replace(SENSITIVE_PAIR_RE, (_match, prefix: string, value: string) => {
    const isQuoted = value.startsWith('"') || value.startsWith("'");
    return `${prefix}${isQuoted ? '"[REDACTED]"' : "[REDACTED]"}`;
  });
  // Header authorization bernilai multi-kata ("Bearer sk-…") tidak ditangkap
  // pair regex di atas (berhenti di spasi) — sapu tambahan untuk sisi klien.
  out = out.replace(/("?authorization"?\s*[:=]\s*)\S[^\n]*/gi, (_m, prefix: string) => `${prefix}[REDACTED]`);
  return out;
}

export function redactSecretsDeep<T>(value: T): T {
  const re = /(password|passwd|passphrase|secret|token|api[-_]?key|private[-_]?key|authorization|credential|psk|cookie)/i;
  const visit = (v: unknown, depth: number): unknown => {
    if (depth > 8) return "[DEPTH]";
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((item) => visit(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = re.test(k) ? "[REDACTED]" : visit(val, depth + 1);
    }
    return out;
  };
  return visit(value, 0) as T;
}
