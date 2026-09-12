import type { NormalizedTool } from "../../policies/normalize";
import { CONNECTION_CHECK_FQ } from "../../tools/mikrotik/status";
import { extractQueryKeywords } from "./ranking-synonyms";
import { intentBoostPrefixes } from "./intent-routing";

/**
 * Batas tool per request agar payload tidak membengkak. Di bawah batas,
 * SELURUH katalog dikirim (tanpa pengurangan kemampuan). Di atas batas,
 * connection probe + docs selalu dipertahankan, sisanya dirangking oleh
 * relevansi kata kunci terhadap pesan pengguna.
 */
export const MAX_PROVIDER_TOOLS = 48;
/** Batas ukuran total schema per request (~17rb token estimasi) agar payload tidak membengkak. */
const MAX_PROVIDER_SCHEMA_CHARS = 60_000;

function schemaChars(t: NormalizedTool): number {
  let schemaLen = 0;
  try {
    schemaLen = JSON.stringify(t.inputSchema ?? {}).length;
  } catch {
    schemaLen = 500;
  }
  return (t.description?.length ?? 0) + schemaLen + (t.fqName?.length ?? 0);
}

const CORE_ROUTER_READ_TOOLS = new Set([
  "list_interfaces",
  "list_ip_addresses",
  "list_routes",
  "get_dhcp_clients",
  "list_dhcp_servers",
  "list_firewall_rules",
  "list_firewall_nat",
  "get_system_resource",
  "print_system_resource",
  "system_identity",
]);

/** Normalisasi token ringan: huruf kecil + singular sederhana (jamak Inggris). */
function stemToken(w: string): string {
  const t = w.toLowerCase();
  if (t.length > 5 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function hasAny(set: Set<string>, list: string[]): boolean {
  for (const item of list) if (set.has(item)) return true;
  return false;
}

/** Skor relevansi satu tool terhadap kata kunci (dipakai ranking + budget deskripsi). */
export function scoreToolForQuery(t: NormalizedTool, keywords: Set<string>): number {
  if (t.fqName === "skills:read" || t.fqName === CONNECTION_CHECK_FQ) return 1_000_000;
  let base = 0;
  if (t.fqName.startsWith("office:")) {
    // Tool dokumen (docx/xlsx/pdf/pptx) prioritas tinggi: jangan terpotong
    // budget 48-tool pada query umum ("ubah namanya jadi ...").
    base = 900_000;
  } else if (/^(general|mikrotik|drive|gdocs|sheets|slides|gmail|calendar|telegram|web|git|data|text|project|compute|archive|system):/.test(t.fqName)) {
    base = 700_000;
  } else if (CORE_ROUTER_READ_TOOLS.has(t.rawName)) {
    base = 600_000;
  } else if (t.fqName.startsWith("docs:")) {
    base = 10_000;
  }

  let domainBoost = 0;
  if (t.fqName.startsWith("general:") && hasAny(keywords, ["code", "file", "workspace", "shell", "execute", "test", "zip", "read", "write"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("gmail:") && hasAny(keywords, ["mail", "gmail", "inbox", "draft", "send", "message"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("calendar:") && hasAny(keywords, ["calendar", "schedule", "event", "meeting"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("drive:") && hasAny(keywords, ["drive", "document", "doc"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("gdocs:") && hasAny(keywords, ["docs", "document", "dokumen", "doc"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("sheets:") && hasAny(keywords, ["sheets", "spreadsheet", "excel", "untung", "lembar"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("slides:") && hasAny(keywords, ["slides", "presentation", "presentasi", "powerpoint", "ppt"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("telegram:") && hasAny(keywords, ["telegram", "bot", "chat"])) {
    domainBoost += 100_000;
  } else if (t.fqName.startsWith("web:") && hasAny(keywords, ["web", "search", "research", "news", "price", "query"])) {
    domainBoost += 150_000;
  } else if (t.fqName.startsWith("office:") && hasAny(keywords, ["excel", "spreadsheet", "word", "docx", "xlsx", "pdf", "ppt", "pptx", "powerpoint", "presentation", "dokumen", "presentasi"])) {
    domainBoost += 150_000;
  }

  const hay = `${t.fqName} ${t.description} ${(t.capabilities ?? []).join(" ")}`.toLowerCase();
  const hayTokens = new Set(hay.split(/[^a-z0-9]+/).filter(Boolean).map(stemToken));
  let s = 0;
  for (const rawKw of keywords) {
    const kw = stemToken(rawKw);
    if (!kw) continue;
    if (hay.includes(rawKw.toLowerCase())) {
      s += rawKw.length >= 5 ? 200 : 100;
      continue;
    }
    if (kw.length >= 4) {
      for (const ht of hayTokens) {
        if (ht.length >= 4 && (ht.startsWith(kw) || kw.startsWith(ht))) {
          s += 60;
          break;
        }
      }
    }
  }
  return base + domainBoost + s;
}

export function selectRelevantTools(catalog: NormalizedTool[], userText: string): NormalizedTool[] {
  const totalSchema = catalog.reduce((n, t) => n + schemaChars(t), 0);
  if (catalog.length <= MAX_PROVIDER_TOOLS && totalSchema <= MAX_PROVIDER_SCHEMA_CHARS) return catalog;
  const keywords = extractQueryKeywords(userText);
  // Pre-routing intent (soft boost, bukan exclude): tool yang cocok intent
  // pengguna didahulukan saat katalog melebihi budget 48 tool / 60k skema.
  const boosts = intentBoostPrefixes(userText);
  const intentBoostOf = (t: NormalizedTool): number => {
    for (const prefix of boosts) if (t.fqName === prefix || t.fqName.startsWith(prefix)) return 120_000;
    return 0;
  };
  // Rangking menurun, isi rakus sampai batas jumlah ATAU ukuran schema —
  // probe koneksi selalu ikut walau budget ketat.
  const ranked = [...catalog]
    .map((t, i) => ({ t, s: scoreToolForQuery(t, keywords) + intentBoostOf(t), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const picked: typeof ranked = [];
  let chars = 0;
  for (const e of ranked) {
    if (picked.length >= MAX_PROVIDER_TOOLS) break;
    const c = schemaChars(e.t);
    if (e.t.fqName !== CONNECTION_CHECK_FQ && chars + c > MAX_PROVIDER_SCHEMA_CHARS) continue;
    picked.push(e);
    chars += c;
  }
  if (!picked.some((e) => e.t.fqName === CONNECTION_CHECK_FQ)) {
    const probe = ranked.find((e) => e.t.fqName === CONNECTION_CHECK_FQ);
    if (probe) picked.push(probe);
  }
  return picked
    .sort((a, b) => a.i - b.i)
    .map((e) => e.t);
}

export { canonicalKey, findDirectToolsForQuery } from "./ranking-query";
