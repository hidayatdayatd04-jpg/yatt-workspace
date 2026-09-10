import { and, eq } from "drizzle-orm";
import type { IntegrationSettings } from "@shared/index";
import type { Database } from "../../db";
import { integrations } from "../../db/schema";
import { openSecret, type KeyRing } from "../../lib/crypto";
import type { IntegrationKind } from "@shared/index";

export type GoogleCreds = NonNullable<IntegrationSettings["credentials"]>;
export type IntegrationRow = typeof integrations.$inferSelect | undefined;

export function readIntegrationSecret(
  keyRing: KeyRing,
  userId: string,
  kind: IntegrationKind,
  r: IntegrationRow,
): GoogleCreds | null {
  if (!r?.ciphertext || !r.nonce || !r.authTag) return null;
  const plain = openSecret(keyRing, { ciphertext: r.ciphertext, nonce: r.nonce, authTag: r.authTag, keyVersion: r.keyVersion }, userId, `integration:${kind}`);
  if (!plain) return null;
  try {
    return JSON.parse(plain) as GoogleCreds;
  } catch {
    return null;
  }
}

export function integrationWhere(userId: string, kind: IntegrationKind) {
  return and(eq(integrations.userId, userId), eq(integrations.kind, kind));
}

export async function selectIntegrationRow(db: Database, userId: string, kind: IntegrationKind) {
  return (await db.select().from(integrations).where(integrationWhere(userId, kind)).limit(1))[0];
}
