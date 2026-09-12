import type { ChatMessage, ChatToolCall } from "../chat-client";
import type { RunCounters } from "./context";

/** Hasil penanganan akhir giliran teks (tanpa tool call). */
export type StepFinishAction =
  | { action: "end" }
  | { action: "next" }
  | { action: "tools" };

/**
 * Giliran final kosong BUKAN jawaban selesai — bahkan bila giliran sebelumnya
 * berisi preamble + tool. Preamble bukan sintesis hasil; model wajib
 * menyimpulkan tool. Guard anti-berhenti prematur meneruskan run bila model
 * baru menulis rencana tanpa memanggil tool.
 */
export function handleStepFinish(
  counters: RunCounters,
  args: {
    stepText: string;
    stepToolCalls: ChatToolCall[];
    stepFinishReason: string | undefined;
    step: number;
    greetingOnly: boolean;
    providerToolsLength: number;
    chatHistory: ChatMessage[];
  },
): StepFinishAction {
  const { stepText, stepToolCalls, stepFinishReason } = args;
  // Temuan 4: validate finishReason — truncated output is not completed
  if (stepFinishReason === "length") {
    counters.finalStatus = "failed";
    counters.failCode = "TRUNCATED_RESPONSE";
    counters.failMessage = "Output provider terpotong karena batas token tercapai (finish_reason=length). Respons tidak lengkap.";
    return { action: "end" };
  }
  if (stepFinishReason === "content_filter") {
    counters.finalStatus = "failed";
    counters.failCode = "CONTENT_FILTERED";
    counters.failMessage = "Respons provider dihentikan oleh filter konten (finish_reason=content_filter).";
    return { action: "end" };
  }
  if (stepToolCalls.length === 0) {
    if (!stepText.trim()) {
      if (counters.toolCallsTotal > 0 && (counters.emptyResponseRetries ?? 0) < 1) {
        counters.emptyResponseRetries = (counters.emptyResponseRetries ?? 0) + 1;
        args.chatHistory.push({ role: "user", content: "[Sistem: respons akhir Anda kosong. Hasil tool sebelumnya sudah tersedia. Sampaikan hasil yang terverifikasi sekarang. Jangan mengulang tool, penulisan file, atau mutasi. Jika ada kegagalan, jelaskan dengan jujur.]" });
        return { action: "next" };
      }
      counters.finalStatus = "failed";
      counters.failCode = "EMPTY_RESPONSE";
      counters.failMessage =
        counters.toolCallsTotal > 0
          ? "Provider AI mengakhiri giliran tanpa menyimpulkan hasil tool yang sudah dibaca."
          : "Provider AI mengakhiri giliran tanpa memberikan teks jawaban atau pemanggilan tool.";
      return { action: "end" };
    }

    // Guard anti-berhenti prematur: bila model hanya mengeluarkan kalimat rencana/pengantar
    // tindakan tanpa memanggil tool pada giliran ini, jangan matikan loop!
    //  - step awal tanpa tool sama sekali → nudge memaksa tool SEKARANG.
    //  - setelah tool berjalan → penalaran tanpa tindakan di-nudge SEKALI agar
    //    model berhenti mengulang berpikir (loop thinking tanpa kemajuan).
    const isPlanText =
      !args.greetingOnly &&
      !/```/.test(stepText) && stepText.length < 700 &&
      /(?:saya akan|akan saya|mari kita|sebentar saya|izinkan saya|saya periksa|saya cek|akan kami|saya bant(?:u|uin)\s+(?:periksa|cek|lihat|analisa|analisis|buat|buatkan|tulis|baca|jalankan|cari|carikan|telusuri|susun|kerjakan|selesaikan|perbaiki)|saya carikan|saya buatkan|saya tulis|saya baca|saya jalankan|saya coba|coba saya|biar saya|akan segera|saya telusuri|let me|i will)\b/i.test(stepText);
    const isPreambleWithoutTool = isPlanText && args.providerToolsLength > 0 &&
      (counters.toolCallsTotal === 0
        ? args.step < 2
        : (counters.thinkNudges ?? 0) < 1 && args.step < 8);

    if (isPreambleWithoutTool) {
      counters.thinkNudges = (counters.thinkNudges ?? 0) + 1;
      args.chatHistory.push({ role: "assistant", content: stepText });
      args.chatHistory.push({
        role: "user",
        content:
          "[Sistem: Anda baru menulis rencana/penalaran TANPA tindakan pada giliran ini. JANGAN mengulang penalaran atau rencana yang sama. Langsung panggil SEKARANG tool yang relevan; bila pekerjaan sudah selesai atau gagal permanen, sampaikan jawaban akhir yang jujur sekarang.]",
      });
      return { action: "next" };
    }

    args.chatHistory.push({ role: "assistant", content: stepText });
    return { action: "end" };
  }
  return { action: "tools" };
}
