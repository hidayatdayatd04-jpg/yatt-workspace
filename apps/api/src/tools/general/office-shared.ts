import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { workspacePath, workspaceRoot } from "./file-paths";

/** Resolve path workspace aman (anti-traversal/symlink) untuk keluarga tool office. */
export async function officeTarget(baseDir: string, userId: string, path: string) {
  return workspacePath(await workspaceRoot(baseDir, userId), path);
}

/** Baca file + verifikasi expectedHash (opsional) — error bila berubah sejak terakhir dibaca. */
export async function readForEdit(file: string, expectedHash?: string) {
  const current = await readFile(file);
  const hash = createHash("sha256").update(current).digest("hex");
  if (expectedHash && hash !== expectedHash) {
    throw new Error("File berubah sejak terakhir dibaca (hash tidak cocok). Baca ulang sebelum mengedit.");
  }
  return { bytes: current, hash };
}

/** Tulis hasil edit ke path absolut + metadata standar tool tulis (pola general:write_file). */
export async function writeEdited(file: string, relPath: string, bytes: Buffer | Uint8Array) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { path: relPath, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}
