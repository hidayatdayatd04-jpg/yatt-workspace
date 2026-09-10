import { desc, eq } from "drizzle-orm";
import type { Database } from "../../db";
import { messages } from "../../db/schema";
import type { ChatMessage } from "../chat-client";
import type { StartRunInput } from "./types";
import { buildContinueNote } from "./history-continue";

/**
 * conversation history: summary replaces old turns (no duplication).
 * Latest summary's throughSeq marks already-compacted history.
 */
export async function assembleHistory(
  db: Database,
  input: StartRunInput,
): Promise<{ chatHistory: ChatMessage[] }> {
  let throughSeq = 0;
  try {
    const { conversationSummaries } = await import("../../db/schema");
    const sums = await db
      .select()
      .from(conversationSummaries)
      .where(eq(conversationSummaries.conversationId, input.conversationId))
      .orderBy(desc(conversationSummaries.version))
      .limit(1);
    throughSeq = sums[0]?.throughSeq ?? 0;
  } catch {
    throughSeq = 0;
  }
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, input.conversationId))
    .orderBy(desc(messages.seq))
    .limit(60);
  const unsummarized = history.filter((m) => (m.seq as number) > throughSeq).slice(0, 24);
  const chatHistory: ChatMessage[] = [{ role: "system", content: input.systemInstruction }];
  for (const m of unsummarized.reverse()) {
    // Skip failed or cancelled assistant messages so previous provider errors (e.g. 429 rate limit
    // from a different provider or network issues) do not contaminate the context or cause the model
    // to hallucinate that it is also rate-limited!
    if (m.role === "assistant" && (m.status === "failed" || m.status === "cancelled")) {
      continue;
    }
    if (m.role === "user") {
      const content = m.content as { text?: string; context?: string };
      // Batas per-pesan agar lampiran/dump besar tidak meledakkan konteks
      // setiap turn (lampiran penuh tetap tersimpan di storage).
      const combined = String(content?.text ?? "") + (content?.context ?? "");
      chatHistory.push({ role: "user", content: combined.slice(0, 12_000) });
    } else if (m.role === "assistant") {
      const text = String((m.content as { text?: string })?.text ?? "").trim();
      if (text) {
        chatHistory.push({ role: "assistant", content: text });
      }
    }
  }

  // Gambar vision hanya untuk giliran user saat ini (lampiran yang baru
  // diupload): tempel sebagai image part pada pesan user TERAKHIR agar
  // provider multimodal benar-benar melihat isinya. Riwayat lama tetap teks
  // agar payload tidak meledak.
  const visionImages = (input.visionImages ?? [])
    .filter((img) => typeof img.dataUrl === "string" && img.dataUrl.startsWith("data:image/"))
    .slice(0, 3);
  if (visionImages.length > 0) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg?.role === "user") {
        msg.images = visionImages.map((img) => ({ mime: img.mime, dataUrl: img.dataUrl, name: img.name }));
        break;
      }
    }
  }

  // Ensure history does not end with an assistant turn (strictly required by Gemini API)
  while (chatHistory.length > 1 && chatHistory[chatHistory.length - 1]?.role === "assistant") {
    chatHistory.pop();
  }

  const continueNote = await buildContinueNote(db, input);
  if (continueNote) chatHistory.push(continueNote);
  return { chatHistory };
}
