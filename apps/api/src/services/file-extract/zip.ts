import { readZipEntries } from "./zip-entries";
import { decodeText, looksTextualFile } from "./text";
import { extractPdfText } from "./pdf";
import { extractOfficeText } from "./office";

const MAX_ZIP_ENTRIES = 150;
const MAX_ZIP_ENTRY_BYTES = 2_000_000;
const MAX_ZIP_FILE_CHARS = 12_000;
const MAX_ZIP_TOTAL_CHARS = 80_000;
const MAX_ZIP_DEPTH = 2;

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tif", "tiff", "mp3", "mp4", "avi",
  "mov", "mkv", "wav", "flac", "ogg", "rar", "7z", "gz", "tar", "bz2", "xz", "exe",
  "dll", "so", "dylib", "bin", "dat", "db", "sqlite", "wasm", "class", "jar", "war",
  "otf", "ttf", "woff", "woff2", "eot", "psd", "ai", "sketch", "dmg", "iso", "msi", "apk",
]);

function isBinaryEntry(name: string): boolean {
  const base = name.toLowerCase().split("/").pop() ?? name;
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Ekstrak folder/arsip ZIP: daftar entri + isi semua file teks/kode/PDF/
 * dokumen di dalamnya. ZIP bersarang diikuti hingga kedalaman MAX_ZIP_DEPTH.
 * Aman terhadap zip-bomb lewat batas entri, byte per entri, dan total karakter.
 */
export async function extractArchiveText(name: string, bytes: Buffer, depth: number): Promise<string | null> {
  let files: Record<string, Uint8Array>;
  try {
    files = readZipEntries(bytes).files;
  } catch (error) {
    return `[ZIP gagal dibaca: ${error instanceof Error ? error.message : "arsip rusak atau terenkripsi"}]`;
  }
  const entries = Object.entries(files).filter(
    ([n, data]) => !n.endsWith("/") && data.length > 0 && !n.startsWith("__MACOSX/") && !n.split("/").pop()?.startsWith("._"),
  );
  const readable = entries.filter(([n]) => !isBinaryEntry(n)).slice(0, MAX_ZIP_ENTRIES);
  const lines: string[] = [`Arsip "${name}": ${entries.length} entri. Daftar file:\n${entries.map(([n]) => n).join("\n")}\nCuplikan isi berikut dibatasi. Gunakan general:read_attachment dengan entryPath untuk membaca file tertentu.`];
  let total = 0;
  let written = 0;
  for (const [entryName, data] of readable) {
    if (total >= MAX_ZIP_TOTAL_CHARS) {
      lines.push("[... sisa entri dilewati: batas konteks tercapai]");
      break;
    }
    if (data.length > MAX_ZIP_ENTRY_BYTES) {
      lines.push(`--- ${entryName}: dilewati (${data.length} byte > batas per file) ---`);
      continue;
    }
    const lower = entryName.toLowerCase();
    let content: string | null = null;
    if (lower.endsWith(".zip") && depth < MAX_ZIP_DEPTH) content = await extractArchiveText(entryName, Buffer.from(data), depth + 1);
    else if (lower.endsWith(".pdf")) content = await extractPdfText(Buffer.from(data));
    else if (/\.(docx|xlsx|xls|pptx|odt|ods|odp)$/.test(lower)) content = await extractOfficeText(entryName, Buffer.from(data));
    else if (looksTextualFile(entryName)) content = decodeText(Buffer.from(data));
    if (!content || !content.trim()) continue;
    const clipped = content.length > MAX_ZIP_FILE_CHARS ? `${content.slice(0, MAX_ZIP_FILE_CHARS)}\n[... terpotong]` : content;
    lines.push(`--- file: ${entryName} ---\n${clipped}`);
    total += clipped.length;
    written += 1;
  }
  if (written === 0) lines.push("Tidak ada isi teks yang berhasil diekstrak. Daftar nama bukan bukti isi file.");
  return lines.join("\n\n");
}
