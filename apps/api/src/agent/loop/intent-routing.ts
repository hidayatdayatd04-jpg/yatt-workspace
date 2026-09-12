import { extractQueryKeywords } from "./ranking-synonyms";

/**
 * Klasifikasi intent ringan untuk pre-routing tool: kumpulan kategori yang
 * cocok dengan pesan pengguna. Soft signal — dipakai sebagai boost ranking
 * saat katalog melebihi budget, bukan hard-exclude (aman untuk multi-intent).
 */
export type IntentCategory =
  | "FILES"
  | "CODE_SEARCH"
  | "CODE_EDIT"
  | "SHELL"
  | "BUILD"
  | "GIT"
  | "ARCHIVE"
  | "OFFICE"
  | "WEB_SEARCH"
  | "WEB_FETCH"
  | "DATA"
  | "COMPUTE"
  | "GOOGLE_DRIVE"
  | "GOOGLE_DOCS"
  | "GOOGLE_SHEETS"
  | "GOOGLE_SLIDES"
  | "GMAIL"
  | "CALENDAR"
  | "TELEGRAM"
  | "ROUTER"
  | "SYSTEM"
  | "PROCESS";

/** Peta kategori → prefix/fitur tool yang relevan (dipakai ranking boost). */
const INTENT_TOOL_PREFIXES: Record<IntentCategory, string[]> = {
  FILES: ["general:read_file", "general:list_files", "general:search_files"],
  CODE_SEARCH: ["general:search_code", "general:search_files"],
  CODE_EDIT: ["general:apply_patch", "general:write_file", "general:replace_text"],
  SHELL: ["general:execute_shell"],
  BUILD: ["project:run_script", "project:detect", "project:scripts", "general:execute_shell"],
  GIT: ["git:"],
  ARCHIVE: ["general:extract_zip", "archive:"],
  OFFICE: ["office:"],
  WEB_SEARCH: ["web:search"],
  WEB_FETCH: ["web:fetch_url"],
  DATA: ["data:", "text:"],
  COMPUTE: ["compute:", "data:statistics"],
  GOOGLE_DRIVE: ["drive:"],
  GOOGLE_DOCS: ["gdocs:"],
  GOOGLE_SHEETS: ["sheets:"],
  GOOGLE_SLIDES: ["slides:"],
  GMAIL: ["gmail:"],
  CALENDAR: ["calendar:"],
  TELEGRAM: ["telegram:"],
  ROUTER: ["mikrotik:", "system:check_connection", "docs:"],
  SYSTEM: ["system:platform", "system:resources", "system:network_interfaces", "system:environment_capabilities"],
  PROCESS: ["general:start_process", "general:process_output", "general:process_status", "general:stop_process"],
};

const KEYWORD_CATEGORIES: Array<[IntentCategory, string[]]> = [
  ["GIT", ["git", "commit", "branch", "checkout", "merge", "rebase", "diff", "stash", "repositori"]],
  ["ARCHIVE", ["zip", "unzip", "extract", "arsip", "ekstrak", "archive", "compress"]],
  ["OFFICE", ["word", "docx", "excel", "xlsx", "spreadsheet", "pdf", "ppt", "pptx", "powerpoint", "presentasi", "slide", "dokumen", "office"]],
  ["WEB_SEARCH", ["search", "cari", "riset", "research", "berita", "news", "tavily", "informasi", "internet", "harga"]],
  ["WEB_FETCH", ["url", "fetch", "buka situs", "baca halaman", "endpoint", "api publik", "dokumen online"]],
  ["DATA", ["csv", "json", "kolom", "baris", "tabel", "data", "statistik", "rata-rata", "mean", "median", "spreadsheet"]],
  ["COMPUTE", ["python", "hitung", "kalkulasi", "algoritma", "matrix", "regresi", "simulasi"]],
  ["GOOGLE_DRIVE", ["drive", "dokumen google", "google docs", "file drive"]],
  ["GOOGLE_DOCS", ["google docs", "docs google", "dokumen online", "docs"]],
  ["GOOGLE_SHEETS", ["google sheets", "sheets google", "spreadsheet google", "sheets"]],
  ["GOOGLE_SLIDES", ["google slides", "slides google", "presentasi google", "slide google"]],
  ["GMAIL", ["email", "surat", "inbox", "draft", "draf", "mail", "gmail"]],
  ["CALENDAR", ["kalender", "jadwal", "agenda", "event", "acara", "rapat", "meeting"]],
  ["TELEGRAM", ["telegram", "bot", "pesan telegram"]],
  ["ROUTER", ["router", "mikrotik", "routeros", "vlan", "interface", "firewall", "bandwidth", "dhcp", "ssid", "wifi", "nat"]],
  ["SHELL", ["shell", "command", "perintah", "terminal", "powershell", "bash", "cmd", "cli"]],
  ["BUILD", ["build", "test", "lint", "typecheck", "compile", "kompilasi", "dev server", "migration", "migrasi"]],
  ["PROCESS", ["proses", "server jalan", "dev server", "watch", "background", "hentikan proses", "kill process", "npm run dev", "bun run dev"]],
  ["FILES", ["file", "berkas", "folder", "direktori", "baca", "read", "list", "daftar", "path"]],
  ["CODE_SEARCH", ["grep", "cari kode", "search code", "penggunaan", "import", "fungsi", "function", "definisi", "referensi", "where used"]],
  ["CODE_EDIT", ["edit", "ubah kode", "patch", "perbaiki", "fix", "refactor", "tulis file", "write file", "buat file"]],
  ["SYSTEM", ["platform", "cpu", "memori", "memory", "disk", "kapabilitas", "environment", "os", "interface jaringan host"]],
];

/** Klasifikasi intent dari teks pengguna (kata kunci + sinonim ID→EN). */
function classifyIntent(userText: string): Set<IntentCategory> {
  const keywords = extractQueryKeywords(userText);
  const rawTokens = new Set(userText.toLowerCase().split(/[^a-z0-9_-]+/).filter((w) => w.length >= 2));
  const haystack = new Set([...keywords, ...rawTokens]);
  const out = new Set<IntentCategory>();
  for (const [category, words] of KEYWORD_CATEGORIES) {
    for (const word of words) {
      if (haystack.has(word) || [...haystack].some((k) => k.startsWith(word) && word.length >= 4)) {
        out.add(category);
        break;
      }
    }
  }
  return out;
}

/** Daftar fqName prefix yang di-boost untuk intent terdeteksi. */
export function intentBoostPrefixes(userText: string): Set<string> {
  const boosts = new Set<string>();
  for (const category of classifyIntent(userText)) {
    for (const prefix of INTENT_TOOL_PREFIXES[category]) boosts.add(prefix);
  }
  return boosts;
}
