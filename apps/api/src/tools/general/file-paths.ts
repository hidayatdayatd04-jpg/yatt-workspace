import { createHash } from "node:crypto";
import { mkdir, lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export async function workspaceRoot(baseDir: string, userId: string) {
  const root = resolve(baseDir, "workspaces", createHash("sha256").update(userId).digest("hex"));
  await mkdir(root, { recursive: true });
  return realpath(root);
}
/** Reject traversal and links (including Windows junctions) for every existing path component. */
export async function workspacePath(root: string, path: string) {
  if (isAbsolute(path) || /[:\x00]/.test(path)) throw new Error("Gunakan path relatif di workspace.");
  const destination = resolve(root, path);
  const rel = relative(root, destination);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("Path di luar workspace ditolak.");
  let part = root;
  for (const segment of rel.split(sep).filter(Boolean)) {
    part = resolve(part, segment);
    const stat = await lstat(part).catch((err: NodeJS.ErrnoException) => { if (err.code === "ENOENT") return null; throw err; });
    if (stat?.isSymbolicLink()) throw new Error("Symlink dan junction tidak boleh diakses oleh tools file.");
  }
  return destination;
}
