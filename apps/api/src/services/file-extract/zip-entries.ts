import { unzipSync } from "fflate";
import { inspectZip, MAX_EXPANDED_BYTES, zipLimit } from "./zip-limits";

/** Batasi hanya isi yang benar-benar dibaca, bukan entri lain di arsip. */
export function readZipEntries(bytes: Buffer, selected?: string) {
  const entries = inspectZip(bytes);
  if (selected === "") return { entries, files: {} as Record<string, Uint8Array> };
  const chosen = selected === undefined ? entries : entries.filter((entry) => entry.name === selected);
  if (selected !== undefined && chosen.length === 0) throw new Error("Entri tidak ditemukan di ZIP. Gunakan nama persis dari daftar entri.");
  const total = chosen.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  if (total > MAX_EXPANDED_BYTES) zipLimit("isi yang dibaca (byte)", total, MAX_EXPANDED_BYTES);
  const files = unzipSync(bytes, { filter: (entry) => selected === undefined || entry.name === selected });
  const actual = Object.values(files).reduce((sum, data) => sum + data.length, 0);
  if (actual > MAX_EXPANDED_BYTES) zipLimit("isi yang dibaca (byte)", actual, MAX_EXPANDED_BYTES);
  return { entries, files };
}
