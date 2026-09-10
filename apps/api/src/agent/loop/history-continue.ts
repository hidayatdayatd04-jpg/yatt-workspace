import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db";
import type { ChatMessage } from "../chat-client";
import type { StartRunInput } from "./types";

/** Konteks "lanjutkan/continue": rangkum progres run sebelumnya (tanpa mutasi ulang). */
export async function buildContinueNote(
  db: Database,
  input: StartRunInput,
): Promise<ChatMessage | null> {
  if (!/lanjutkan|teruskan|continue/i.test(input.userText)) return null;
  try {
    const { toolExecutions: toolTable, agentRuns: runsTable } = await import("../../db/schema");
    const lastRuns = await db
      .select({ id: runsTable.id })
      .from(runsTable)
      .where(eq(runsTable.conversationId, input.conversationId))
      .orderBy(desc(runsTable.createdAt))
      .limit(3);
    const priorNotes: string[] = [];
    const failedNotes: string[] = [];
    for (const r of lastRuns) {
      if (r.id === input.runId) continue;
      const rows = await db.select().from(toolTable).where(eq(toolTable.runId, r.id)).limit(30);
      for (const row of rows) {
        if (row.status === "completed" && row.risk === "read" && row.resultSummary) {
          if (priorNotes.length < 8) {
            priorNotes.push(`- ${row.toolName}: ${String(row.resultSummary).slice(0, 400)}`);
          }
        } else if (row.status !== "completed" && failedNotes.length < 4) {
          failedNotes.push(
            `- ${row.toolName}: GAGAL (${String(row.errorCode ?? row.status)}) — putuskan apakah perlu dicoba lagi untuk melengkapi jawaban.`,
          );
        }
      }
      if (priorNotes.length >= 8 && failedNotes.length >= 4) break;
    }
    let partialNote = "";
    try {
      const { messages } = await import("../../db/schema");
      const failed = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, input.conversationId),
            eq(messages.role, "assistant"),
            inArray(messages.status, ["failed", "cancelled"]),
          ),
        )
        .orderBy(desc(messages.seq))
        .limit(1);
      const raw = String((failed[0]?.content as { text?: string } | null)?.text ?? "");
      const cleaned = (raw.split("\n\n---\nPemeriksaan belum selesai (")[0] ?? "").trim();
      if (cleaned) {
        partialNote =
          "[Jawaban parsial run sebelumnya yang TERPUTUS — jadikan petunjuk progres, bukan fakta terverifikasi:]\n" +
          cleaned.slice(0, 2000);
      }
    } catch {
      /* partial opsional */
    }
    const parts: string[] = [];
    if (priorNotes.length > 0) {
      parts.push(
        "[Hasil pembacaan sebelumnya yang masih tersimpan — pakai langsung bila masih valid, jangan diulang. Hanya baca ulang yang kedaluwarsa/diragukan:] \n" +
          priorNotes.join("\n"),
      );
    }
    if (failedNotes.length > 0) {
      parts.push("[Tool yang sempat GAGAL pada run sebelumnya:]\n" + failedNotes.join("\n"));
    }
    if (partialNote) parts.push(partialNote);
    if (parts.length === 0) return null;
    return {
      role: "user",
      content:
        "[MODE LANJUTAN: pengguna meminta meneruskan pekerjaan yang terputus karena error. " +
        "Aturan: 1) identifikasi dari konteks di atas bagian mana yang SUDAH selesai; " +
        "2) JANGAN ulangi pembacaan yang hasilnya sudah ada; " +
        "3) kerjakan HANYA sisa yang belum selesai atau belum dimulai; " +
        "4) akhiri dengan jawaban lengkap yang merangkum SEMUA temuan (lama + baru).]\n" +
        parts.join("\n\n"),
    };
  } catch {
    return null;
  }
}
