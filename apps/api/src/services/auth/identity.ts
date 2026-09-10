import { eq, or } from "drizzle-orm";
import type { Database } from "../../db";
import { accounts } from "../../db/schema";
import { AppError } from "../../lib/errors";

export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IdentityPatch {
  username?: string;
  email?: string | null;
}

function validatePatch(patch: IdentityPatch): { username?: string; email?: string | null } {
  const out: { username?: string; email?: string | null } = {};
  if (patch.username !== undefined) {
    const username = patch.username.trim();
    if (!USERNAME_RE.test(username)) {
      throw new AppError("VALIDATION_FAILED", "Username 3-32 karakter; hanya huruf, angka, titik, strip, dan underscore.", 422);
    }
    out.username = username;
  }
  if (patch.email !== undefined) {
    const email = (patch.email ?? "").trim().toLowerCase();
    if (!email) {
      out.email = null;
    } else if (email.length > 254 || !EMAIL_RE.test(email)) {
      throw new AppError("VALIDATION_FAILED", "Format email tidak valid.", 422);
    } else {
      out.email = email;
    }
  }
  return out;
}

async function assertAvailable(db: Database, accountId: string, patch: { username?: string; email?: string | null }): Promise<void> {
  const conds = [];
  if (patch.username) conds.push(eq(accounts.username, patch.username));
  if (patch.email) conds.push(eq(accounts.email, patch.email));
  if (conds.length === 0) return;
  const rows = await db
    .select({ id: accounts.id, username: accounts.username, email: accounts.email })
    .from(accounts)
    .where(or(...conds))
    .limit(4);
  for (const row of rows) {
    if (row.id === accountId) continue;
    if (patch.username && row.username === patch.username) throw new AppError("VALIDATION_FAILED", "Username sudah dipakai akun lain.", 422);
    if (patch.email && row.email === patch.email) throw new AppError("VALIDATION_FAILED", "Email sudah dipakai akun lain.", 422);
  }
}

/** Update username/email akun dengan validasi + cek keunikan (email disimpan lowercase; kosong = hapus). */
export async function updateIdentity(db: Database, accountId: string, patch: IdentityPatch): Promise<void> {
  const clean = validatePatch(patch);
  await assertAvailable(db, accountId, clean);
  if (Object.keys(clean).length === 0) return;
  try {
    await db.update(accounts).set({ ...clean, updatedAt: new Date() }).where(eq(accounts.id, accountId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg)) throw new AppError("VALIDATION_FAILED", "Username atau email sudah dipakai akun lain.", 422);
    throw err;
  }
}