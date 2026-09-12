/**
 * Resolver icon file/folder terpusat berbasis @yutengjing/vscode-icons.
 * SVG dimuat lokal lewat Vite (import.meta.glob + ?url) — tanpa CDN/request
 * eksternal; hasil build berupa asset ter-hash yang di-cache browser.
 */
import {
  DEFAULT_FILE,
  getIconForFile,
  getIconForFolder,
  getIconForOpenFolder,
} from "@yutengjing/vscode-icons";

// assets berada di apps/web/node_modules (dihitung relatif dari file ini)
const iconUrls = import.meta.glob<string>(
  "../../node_modules/@yutengjing/vscode-icons/assets/icons/*.svg",
  { eager: true, query: "?url", import: "default" },
);

/** Peta basename SVG (mis. "file_type_html.svg") → URL asset lokal. */
const urlBySvg = new Map<string, string>();
for (const [path, url] of Object.entries(iconUrls)) {
  urlBySvg.set(path.split("/").at(-1) ?? path, url);
}

const fileCache = new Map<string, string>();
const folderCache = new Map<string, string>();
const openFolderCache = new Map<string, string>();

/** Ambil segmen nama terakhir dari path (mendukung / dan \). */
function baseName(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/");
  return parts.at(-1) ?? path;
}

function resolveUrl(svgName: string): string {
  return urlBySvg.get(svgName) ?? "";
}

/** URL icon SVG untuk sebuah nama file; resolver menangani nama khusus (package.json, Dockerfile, .env) dan ekstensi majemuk (d.ts). */
export function getFileIcon(fileName: string): string {
  const key = baseName(fileName);
  const cached = fileCache.get(key);
  if (cached !== undefined) return cached;
  const url = resolveUrl(getIconForFile(key) ?? DEFAULT_FILE);
  fileCache.set(key, url);
  return url;
}

/** URL icon folder tertutup; folder dikenal (src, node_modules, .git) mendapat icon khusus. */
export function getFolderIcon(folderName: string): string {
  const key = baseName(folderName);
  const cached = folderCache.get(key);
  if (cached !== undefined) return cached;
  const url = resolveUrl(getIconForFolder(key));
  folderCache.set(key, url);
  return url;
}

/** URL icon folder terbuka (varian _opened). */
export function getOpenFolderIcon(folderName: string): string {
  const key = baseName(folderName);
  const cached = openFolderCache.get(key);
  if (cached !== undefined) return cached;
  const url = resolveUrl(getIconForOpenFolder(key));
  openFolderCache.set(key, url);
  return url;
}
