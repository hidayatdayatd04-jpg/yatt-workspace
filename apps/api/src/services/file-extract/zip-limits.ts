import { unzipSync } from "fflate";
import { ToolResultError } from "../../tools/errors";

export const ZIP_LIMITS = { compressedBytes: 25_000_000, entries: 10_000, entryBytes: 100_000_000, expandedBytes: 250_000_000 };
export const MAX_EXPANDED_BYTES = 25_000_000;
export interface ZipEntry { name: string; sizeBytes: number; directory: boolean }

function safeArchiveName(name: string): boolean {
  return !!name && !/^[\\/]|[:\x00]/.test(name) && !name.replaceAll("\\", "/").split("/").includes("..");
}

export function zipLimit(label: string, actual: number, limit: number): never {
  throw new ToolResultError("ARCHIVE_LIMIT_EXCEEDED", `Batas ekstraksi ZIP terlampaui: ${label} ${actual.toLocaleString("id-ID")}; maksimal ${limit.toLocaleString("id-ID")}.`, {
    guidance: "Jangan mengulang ekstraksi yang sama. Baca daftar ZIP via read_file tanpa entryPath, lalu baca file relevan via entryPath (read_file/read_attachment) atau ekstrak selektif via extract_zip dengan entries berisi daftar nama yang dibutuhkan.",
  });
}

/** Baca direktori ZIP saja; tidak mengembangkan isi ketika hanya melihat daftar. */
export function inspectZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length > ZIP_LIMITS.compressedBytes) zipLimit("ukuran arsip (byte)", bytes.length, ZIP_LIMITS.compressedBytes);
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  unzipSync(bytes, { filter: (entry) => {
    if (!safeArchiveName(entry.name)) throw new Error("Path tidak aman di dalam ZIP.");
    if (names.has(entry.name)) throw new Error("Nama entri ZIP duplikat.");
    names.add(entry.name);
    if (entries.length >= ZIP_LIMITS.entries) zipLimit("jumlah entri", entries.length + 1, ZIP_LIMITS.entries);
    entries.push({ name: entry.name, sizeBytes: entry.originalSize, directory: entry.name.endsWith("/") });
    return false;
  } });
  return entries;
}
