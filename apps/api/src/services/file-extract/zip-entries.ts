import { unzipSync } from "fflate";

export const MAX_EXPANDED_BYTES = 25_000_000;
export function safeArchiveName(name: string): boolean {
  return !/^[\\/]|[:\x00]/.test(name) && !name.replaceAll("\\", "/").split("/").includes("..");
}
/** Validate declared sizes before inflation, then verify actual output sizes. */
export function readZipEntries(bytes: Buffer, selected?: string) {
  const entries: { name: string; sizeBytes: number; directory: boolean }[] = [];
  let total = 0;
  const files = unzipSync(bytes, { filter: (entry) => {
    if (!safeArchiveName(entry.name)) throw new Error("Path tidak aman di dalam ZIP.");
    total += entry.originalSize;
    if (entries.length >= 1000 || entry.originalSize > MAX_EXPANDED_BYTES || total > MAX_EXPANDED_BYTES) {
      throw new Error("Batas ekstraksi ZIP terlampaui (1000 entri / 25 MB).");
    }
    entries.push({ name: entry.name, sizeBytes: entry.originalSize, directory: entry.name.endsWith("/") });
    return selected === undefined || entry.name === selected;
  } });
  if (Object.values(files).reduce((sum, data) => sum + data.length, 0) > MAX_EXPANDED_BYTES) throw new Error("Isi ZIP terlalu besar.");
  if (selected !== undefined && selected !== "" && !Object.hasOwn(files, selected)) throw new Error("Entri tidak ditemukan di ZIP. Gunakan nama persis dari daftar entri.");
  return { entries, files };
}
