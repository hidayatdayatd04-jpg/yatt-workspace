/**
 * Ekstensi & nama file teks/kode yang dikenali + dekoder UTF-8 aman.
 * Mencakup file coding: tsx/ts/js/jsx, html, blade/php, css, json, yaml,
 * python, go, rust, java, c#, sql, shell, dart, dan file konfigurasi lain.
 */
export const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "mdx", "csv", "tsv", "log", "rsc", "json", "jsonc", "json5",
  "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "properties", "plist",
  "xml", "html", "htm", "xhtml", "svg", "css", "scss", "sass", "less", "styl",
  "js", "mjs", "cjs", "ts", "tsx", "jsx", "vue", "svelte", "astro", "hbs", "ejs", "pug",
  "php", "phtml", "blade", "py", "pyw", "rb", "erb", "go", "rs", "java", "kt", "kts",
  "c", "h", "cpp", "hpp", "cc", "cxx", "cs", "fs", "swift", "m", "mm", "scala", "groovy",
  "sql", "sh", "bash", "zsh", "fish", "bat", "cmd", "ps1", "psm1", "lua", "pl", "pm",
  "r", "jl", "dart", "gradle", "cmake", "dockerfile", "makefile", "nginx", "htaccess",
  "gitignore", "gitattributes", "editorconfig", "npmrc", "babelrc", "eslintrc",
  "prettierrc", "babelrc-js", "lock", "bak", "asc", "tex", "srt", "vtt", "patch", "diff",
]);

/** Nama file tanpa ekstensi yang selalu dianggap teks (mis. .gitignore, Dockerfile). */
const TEXT_FILENAMES = new Set([
  "dockerfile", "makefile", ".gitignore", ".gitattributes", ".env", ".editorconfig",
  ".npmrc", ".babelrc", ".eslintrc", ".prettierrc", ".htaccess", "license", "changelog", "readme",
]);

/** True bila nama file (mungkin berada di dalam ZIP) terlihat sebagai teks/kode. */
export function looksTextualFile(name: string): boolean {
  const base = name.toLowerCase().split("/").pop() ?? name;
  if (TEXT_FILENAMES.has(base) || base.endsWith(".blade.php") || base.endsWith(".d.ts")) return true;
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : base;
  return TEXT_EXTENSIONS.has(ext);
}

/** Recognize text without treating arbitrary binary as UTF-8. UTF-16 BOM is supported. */
export function isTextBytes(bytes: Buffer): boolean {
  if (bytes.length >= 2 && ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255))) return true;
  if (bytes.some((b) => b < 32 && ![9, 10, 12, 13].includes(b))) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true }); return true; } catch { return false; }
}

export function decodeText(bytes: Buffer): string {
  if (bytes[0] === 255 && bytes[1] === 254) return bytes.subarray(2).toString("utf16le");
  if (bytes[0] === 254 && bytes[1] === 255) {
    const even = Buffer.from(bytes.subarray(2, bytes.length - bytes.length % 2));
    return even.swap16().toString("utf16le");
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
