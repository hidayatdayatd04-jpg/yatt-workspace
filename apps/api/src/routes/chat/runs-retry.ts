import { and, eq, gt } from "drizzle-orm";
import { AppError } from "../../lib/errors";
import { messages } from "../../db/schema";
import type { ChatCtx, ConversationRow, RunInput } from "./types";

export interface EditedMessage {
  id: string;
  seq: number;
  content: unknown;
}

/** Validasi retry in-place: pesan harus milik user, tanpa kelanjutan di bawahnya. */
export async function resolveEditedMessage(
  deps: ChatCtx["deps"],
  conv: ConversationRow,
  input: RunInput,
): Promise<EditedMessage | null> {
  if (!input.editedMessageId) return null;
  if ((input.attachmentIds ?? []).length > 0) {
    throw new AppError("VALIDATION_FAILED", "Lampiran baru tidak didukung saat mengulang pesan yang sudah ada.", 422);
  }
  const [row] = await deps.db
    .select({ id: messages.id, seq: messages.seq, content: messages.content, role: messages.role })
    .from(messages)
    .where(and(eq(messages.id, input.editedMessageId), eq(messages.conversationId, conv.id)))
    .limit(1);
  if (!row || row.role !== "user") {
    throw new AppError("VALIDATION_FAILED", "Pesan yang diulang tidak ditemukan atau bukan pesan pengguna.", 422);
  }
  const laterUsers = await deps.db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationId, conv.id), eq(messages.role, "user"), gt(messages.seq, row.seq as number)))
    .limit(1);
  if (laterUsers.length > 0) {
    throw new AppError("VALIDATION_FAILED", "Pesan tersebut sudah memiliki kelanjutan di bawahnya; kirim sebagai pesan baru.", 409);
  }
  return { id: row.id, seq: row.seq as number, content: row.content };
}
