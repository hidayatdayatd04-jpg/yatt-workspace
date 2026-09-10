import type { NormalizedTool } from "../../policies/normalize";

export function canonicalKey(fq: string, args: unknown): string {
  if (fq.includes("find_tools") || fq.includes("routeros_search")) {
    if (args && typeof args === "object") {
      const rawQuery = String((args as Record<string, unknown>).query ?? (args as Record<string, unknown>).search ?? "").toLowerCase();
      const normalizedQuery = rawQuery
        .replace(/\b(print|detail|list|export|show|get)\b/g, "")
        .replace(/[^a-z0-9_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return `${fq}\n${JSON.stringify({ query: normalizedQuery || rawQuery })}`;
    }
  }
  try {
    const sortObj = (val: unknown): unknown => {
      if (val === null || typeof val !== "object") return val;
      if (Array.isArray(val)) return val.map(sortObj);
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = sortObj((val as Record<string, unknown>)[k]);
      }
      return sorted;
    };
    return `${fq}\n${JSON.stringify(sortObj(args))}`;
  } catch {
    return `${fq}\n${JSON.stringify(args)}`;
  }
}

/**
 * Alihkan discovery yang tidak perlu ke tool langsung: bila kueri find_tools
 * jelas cocok dengan tool non-discovery yang SUDAH ada di katalog run ini,
 * kembalikan daftar tool langsung tanpa eksekusi pencarian — menghemat
 * round-trip AI dan menuntun model memakai pembacaan langsung.
 */
export function findDirectToolsForQuery(query: unknown, catalog: NormalizedTool[]): NormalizedTool[] {
  const raw = String(query ?? "").toLowerCase();
  const normalized = raw
    .replace(/\b(print|detail|list|export|show|get)\b/g, "")
    .replace(/[^a-z0-9_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  const tokens = normalized.split(" ").filter((w) => w.length >= 4);
  const out: NormalizedTool[] = [];
  for (const t of catalog) {
    if (t.fqName.includes("find_tools") || t.fqName.includes("routeros_search")) continue;
    const nameSpaced = t.rawName.toLowerCase().replace(/_/g, " ");
    const nameFlat = t.rawName.toLowerCase().replace(/_/g, "");
    const queryFlat = normalized.replace(/ /g, "");
    if (nameSpaced.includes(normalized) || normalized.includes(nameSpaced) || nameFlat.includes(queryFlat) || queryFlat.includes(nameFlat)) {
      out.push(t);
      continue;
    }
    const hayTokens = new Set(`${t.rawName} ${(t.capabilities ?? []).join(" ")}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    if (tokens.some((tok) => hayTokens.has(tok))) out.push(t);
  }
  return out.slice(0, 5);
}
