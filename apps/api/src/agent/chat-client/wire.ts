import { AppError } from "../../lib/errors";
import type { ChatMessage, ChatToolDefinition } from "./types";

/**
 * Bentuk wire OpenAI-compatible yang dikirim ke provider.
 * `content` SELALU string (tidak pernah null) untuk pesan teks biasa;
 * pesan user bergambar memakai array multimodal OpenAI ([{type:"text"},{type:"image_url"}]).
 */
export type ProviderWireContent =
  | string
  | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

export interface ProviderWireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: ProviderWireContent;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string }; extra_content?: unknown }[];
  tool_call_id?: string;
}

/**
 * Normalisasi pesan internal → payload provider valid (Gemini / OpenAI / OpenRouter).
 * Melempar AppError VALIDATION_FAILED bila pasangan assistant(tool_calls) ↔ tool result rusak.
 */
export function buildProviderMessages(
  messages: ChatMessage[],
  providerKind: string,
): ProviderWireMessage[] {
  const declared = new Map<string, number>(); // tool_call id → index pesan assistant
  const answered = new Map<string, number>(); // tool_call id → index pesan tool
  const out: ProviderWireMessage[] = [];
  let seenFirstSystem = false;

  messages.forEach((m, idx) => {
    if (m.role === "system" && seenFirstSystem) {
      out.push({ role: "user", content: `[Catatan sistem] ${m.content ?? ""}` });
      return;
    }
    if (m.role === "system") {
      seenFirstSystem = true;
      out.push({ role: "system", content: m.content ?? "" });
      return;
    }
    if (m.role === "tool") {
      const id = (m.toolCallId ?? "").trim();
      if (!id) {
        throw new AppError("VALIDATION_FAILED", `Payload tool rusak (pesan ${idx}): tool_call_id kosong.`, 422);
      }
      if (answered.has(id)) {
        throw new AppError("VALIDATION_FAILED", `Payload tool rusak: tool_call_id "${id}" dijawab dua kali.`, 422);
      }
      answered.set(id, idx);
      out.push({ role: "tool", content: m.content ?? "", tool_call_id: id });
      return;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const calls: NonNullable<ProviderWireMessage["tool_calls"]> = m.toolCalls.map((tc) => {
        if (!tc.id || !tc.name) {
          throw new AppError("VALIDATION_FAILED", `Payload tool rusak (pesan ${idx}): tool call tanpa id/nama.`, 422);
        }
        if (declared.has(tc.id)) {
          throw new AppError("VALIDATION_FAILED", `Payload tool rusak: tool_call_id "${tc.id}" dideklarasikan dua kali.`, 422);
        }
        declared.set(tc.id, idx);
        return {
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: sanitizeToolArguments(tc.argumentsJson) },
          ...(providerKind === "gemini" && tc.extraContent !== undefined ? { extra_content: tc.extraContent } : {}),
        };
      });
      out.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
      return;
    }
    if (m.role === "user" && m.images?.length) {
      const text = m.content ?? "";
      out.push({
        role: "user",
        content: [
          ...(text ? [{ type: "text" as const, text }] : []),
          ...m.images.map((img) => ({ type: "image_url" as const, image_url: { url: img.dataUrl } })),
        ],
      });
      return;
    }
    out.push({ role: m.role as "user" | "assistant", content: m.content ?? "" });
  });

  for (const [id] of declared) {
    if (!answered.has(id)) {
      throw new AppError("VALIDATION_FAILED", `Payload tool rusak: tool_call_id "${id}" tanpa hasil tool.`, 422);
    }
  }
  for (const [id] of answered) {
    if (!declared.has(id)) {
      throw new AppError("VALIDATION_FAILED", `Payload tool rusak: hasil tool "${id}" tanpa pemanggil.`, 422);
    }
  }
  return out;
}

/** Argumen tool harus berupa objek JSON valid; selain itu kirim "{}" agar provider tidak 400. */
export function sanitizeToolArguments(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "{}";
  try {
    const parsed: unknown = JSON.parse(s);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) return s;
    return "{}";
  } catch {
    return "{}";
  }
}

/** Pastikan definisi tool berupa function-object valid; default schema kosong yang aman. */
export function buildProviderTools(tools: ChatToolDefinition[]): ChatToolDefinition[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters:
        t.function.parameters && typeof t.function.parameters === "object"
          ? (t.function.parameters as Record<string, unknown>)
          : { type: "object", properties: {} },
    },
  }));
}
