import { and, eq, gt, inArray } from "drizzle-orm";
import { attachments, messages } from "../../db/schema";
import type { AttachmentBlock } from "./runs-attachments";
import type { ChatCtx, ConversationRow, RunInput } from "./types";
import type { EditedMessage } from "./runs-retry";

/** Simpan pesan user (baru atau timpa retry) + ikat lampiran. */
export async function persistUserMessage(
  deps: ChatCtx["deps"],
  conv: ConversationRow,
  input: RunInput,
  editedMsg: EditedMessage | null,
  attachmentNote: string,
  attachmentBlocks: AttachmentBlock[],
  wantedIds: string[],
): Promise<string> {
  if (editedMsg) {
    const prevContent =
      editedMsg.content && typeof editedMsg.content === "object" ? (editedMsg.content as Record<string, unknown>) : {};
    await deps.db
      .update(messages)
      .set({
        content: {
          ...prevContent,
          text: input.text,
          ...(attachmentNote ? { context: attachmentNote } : {}),
          attachments: attachmentBlocks.map((b) => ({ id: b.id, name: b.name, kind: b.kind })),
        },
      })
      .where(eq(messages.id, editedMsg.id));
    await deps.db
      .delete(messages)
      .where(and(eq(messages.conversationId, conv.id), gt(messages.seq, editedMsg.seq)));
    return editedMsg.id;
  }
  const all = await deps.db
    .select({ seq: messages.seq })
    .from(messages)
    .where(eq(messages.conversationId, conv.id));
  const maxSeq = all.reduce((m, r) => Math.max(m, r.seq), 0);
  const [userMsg] = await deps.db
    .insert(messages)
    .values({ conversationId: conv.id, role: "user", content: { text: input.text, context: attachmentNote || undefined, attachments: attachmentBlocks.map((b) => ({ id: b.id, name: b.name, kind: b.kind })) }, seq: maxSeq + 1 })
    .returning();
  const userMessageId = userMsg!.id;
  if (wantedIds.length > 0) {
    await deps.db.update(attachments).set({ messageId: userMessageId }).where(inArray(attachments.id, wantedIds));
  }
  return userMessageId;
}
