import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { AppError } from "../lib/errors";

/** Deteksi jenis konten (magic bytes) kini tinggal di services/file-extract. */
export { detectContentKind } from "./file-extract/detect";

const MAX_OBJECT_KEY_LEN = 512;

/** Local files addressed only by server-generated object keys. */
export function createStorageService(deps: { directory: string }) {
  const root = resolve(deps.directory);
  function pathFor(key: string) {
    if (key.length > MAX_OBJECT_KEY_LEN || !/^attachments\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\/[a-f0-9]{32}\.[a-z0-9]+$/.test(key)) {
      throw new AppError("VALIDATION_FAILED", "Object key lokal tidak valid.", 422);
    }
    return resolve(root, ...key.split("/"));
  }
  function buildObjectKey(userId: string, conversationId: string, ext: string) {
    const key = `attachments/${userId}/${conversationId}/${randomBytes(16).toString("hex")}.${ext || "bin"}`;
    pathFor(key);
    return key;
  }
  async function put(input: { objectKey: string; body: Buffer; contentType: string; contentLength: number }) {
    const target = pathFor(input.objectKey);
    if (input.contentLength !== input.body.length) throw new AppError("VALIDATION_FAILED", "Ukuran file tidak cocok.", 422);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      await writeFile(temporary, input.body, { flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch((err: NodeJS.ErrnoException) => { if (err.code !== "ENOENT") throw err; });
    }
    return { checksum: createHash("sha256").update(input.body).digest("hex"), fileId: input.objectKey };
  }
  async function get(objectKey: string): Promise<{ body: Buffer; contentType?: string }> {
    return { body: await readFile(pathFor(objectKey)) };
  }
  async function remove(objectKey: string) {
    await unlink(pathFor(objectKey)).catch((err: NodeJS.ErrnoException) => { if (err.code !== "ENOENT") throw err; });
  }
  return { buildObjectKey, put, get, remove };
}
export type StorageService = ReturnType<typeof createStorageService>;
