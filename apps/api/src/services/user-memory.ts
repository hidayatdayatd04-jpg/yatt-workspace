import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { userMemories } from "../db/schema";
import type { ChatClient } from "../agent/chat-client";

/** Pola sensitif yang TIDAK BOLEH disimpan sebagai memori lintas sesi. */
const SENSITIVE = /password|passwd|secret|api[-_ ]?key|token|otp|pin\b|kredensial/i;

export interface MemoryEntry {
  id: string;
  content: string;
  sourceConversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(row: typeof userMemories.$inferSelect): MemoryEntry {
  return {
    id: row.id,
    content: row.content,
    sourceConversationId: row.sourceConversationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listMemories(db: Database, userId: string, limit = 100): Promise<MemoryEntry[]> {
  const rows = await db
    .select()
    .from(userMemories)
    .where(eq(userMemories.userId, userId))
    .orderBy(desc(userMemories.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(toDTO);
}

/** Ringkasan memori untuk system prompt (non-otoritatif, seperti MEMORY RINGKASAN). */
export async function loadCrossMemory(db: Database, userId: string): Promise<string | null> {
  const rows = await db
    .select({ content: userMemories.content })
    .from(userMemories)
    .where(eq(userMemories.userId, userId))
    .orderBy(desc(userMemories.updatedAt))
    .limit(20);
  if (rows.length === 0) return null;
  return rows
    .map((r) => `- ${String(r.content).slice(0, 300)}`)
    .join("\n")
    .slice(0, 3000);
}

export async function deleteMemory(db: Database, userId: string, memoryId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userMemories.id })
    .from(userMemories)
    .where(and(eq(userMemories.id, memoryId), eq(userMemories.userId, userId)))
    .limit(1);
  if (!row) return false;
  await db.delete(userMemories).where(eq(userMemories.id, memoryId));
  return true;
}

export async function clearMemories(db: Database, userId: string): Promise<number> {
  const rows = await db.select({ id: userMemories.id }).from(userMemories).where(eq(userMemories.userId, userId));
  if (rows.length === 0) return 0;
  await db.delete(userMemories).where(eq(userMemories.userId, userId));
  return rows.length;
}

function sanitizeFacts(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = raw.replace(/^[-*\d.)\s]+/, "").trim().replace(/\.$/, "");
    if (line.length < 12 || line.length > 300) continue;
    if (SENSITIVE.test(line)) continue;
    if (/^\d{1,3}(\.\d{1,3}){3}/.test(line) && /dhcp|dinamis|lease/i.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Ekstraksi ringan fire-and-forget: identifikasi fakta durable yang layak
 * diingat lintas sesi (router favorit, kebiasaan penamaan, preferensi).
 * Tidak menyimpan kredensial/IP dinamis/data sensitif.
 */
export function extractMemoriesAsync(args: {
  db: Database;
  client: ChatClient;
  userId: string;
  conversationId: string;
  userText: string;
  assistantText: string;
  signal?: AbortSignal;
}): void {
  const { db, client, userId, conversationId, userText, assistantText } = args;
  if (!userText.trim() || !assistantText.trim()) return;
  void (async () => {
    try {
      const prompt =
        "Dari percakapan berikut, ekstrak MAKSIMAL 3 fakta durable yang layak diingat lintas sesi " +
        "(mis. model router utama, kebiasaan penamaan VLAN, preferensi pengguna). " +
        "JANGAN sertakan kredensial, password, token, API key, atau IP dinamis. " +
        "Jawab hanya sebagai daftar baris '-' tanpa penjelasan. Bila tidak ada fakta durable, jawab 'TIDAK ADA'.\n\n" +
        `Pengguna: ${userText.slice(0, 1500)}\nAsisten: ${assistantText.slice(0, 1500)}`;
      let collected = "";
      for await (const ev of client.stream({
        messages: [{ role: "user" as const, content: prompt }],
        tools: [],
        maxTokens: 256,
        signal: args.signal,
      })) {
        if (ev.type === "text" && ev.text) collected += ev.text;
        else if (ev.type === "done") break;
        if (collected.length > 1200) break;
      }
      if (/TIDAK ADA/i.test(collected)) return;
      const facts = sanitizeFacts(collected.split("\n"));
      if (facts.length === 0) return;
      const existing = await listMemories(db, userId, 100);
      const known = new Set(existing.map((e) => e.content.toLowerCase()));
      for (const fact of facts) {
        if (known.has(fact.toLowerCase())) continue;
        await db.insert(userMemories).values({ userId, content: fact, sourceConversationId: conversationId });
      }
    } catch {
      /* ekstraksi non-fatal */
    }
  })();
}
