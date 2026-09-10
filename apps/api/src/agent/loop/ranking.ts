import type { NormalizedTool } from "../../policies/normalize";
import { CONNECTION_CHECK_FQ } from "../../tools/mikrotik/status";
import { extractQueryKeywords } from "./ranking-synonyms";

/**
 * Batas tool per request agar payload tidak membengkak. Di bawah batas,
 * SELURUH katalog dikirim (tanpa pengurangan kemampuan). Di atas batas,
 * connection probe + docs selalu dipertahankan, sisanya dirangking oleh
 * relevansi kata kunci terhadap pesan pengguna.
 */
export const MAX_PROVIDER_TOOLS = 48;
/** Batas ukuran total schema per request (~17rb token estimasi) agar payload tidak membengkak. */
export const MAX_PROVIDER_SCHEMA_CHARS = 60_000;

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

/** Skor relevansi satu tool terhadap kata kunci (dipakai ranking + budget deskripsi). */
export function scoreToolForQuery(t: NormalizedTool, keywords: Set<string>): number {
  if (t.fqName === CONNECTION_CHECK_FQ) return 1_000_000;
  if (/^(general|mikrotik|drive|gmail|calendar|telegram):/.test(t.fqName)) return 700_000;
  if (CORE_ROUTER_READ_TOOLS.has(t.rawName)) return 600_000;
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
    // Kecocokan parsial semantik-lite: awalan kata atau sebaliknya (min 4 char)
    // agar typo ringan/jamak ("interface", "addres") tetap menemukan tool.
    if (kw.length >= 4) {
      for (const ht of hayTokens) {
        if (ht.length >= 4 && (ht.startsWith(kw) || kw.startsWith(ht))) {
          s += 60;
          break;
        }
      }
    }
  }
  if (t.fqName.startsWith("docs:") || t.fqName.startsWith("web:")) s += 5_000;
  return s;
}

export function selectRelevantTools(catalog: NormalizedTool[], userText: string): NormalizedTool[] {
  const totalSchema = catalog.reduce((n, t) => n + schemaChars(t), 0);
  if (catalog.length <= MAX_PROVIDER_TOOLS && totalSchema <= MAX_PROVIDER_SCHEMA_CHARS) return catalog;
  const keywords = extractQueryKeywords(userText);
  // Rangking menurun, isi rakus sampai batas jumlah ATAU ukuran schema —
  // probe koneksi selalu ikut walau budget ketat.
  const ranked = [...catalog]
    .map((t, i) => ({ t, s: scoreToolForQuery(t, keywords), i }))
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
