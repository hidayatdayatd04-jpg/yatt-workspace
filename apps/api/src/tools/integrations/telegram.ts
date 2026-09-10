import { z } from "zod";
import type { IntegrationService } from "../../services/integrations";
import { defineTool, objectSchema, stringField } from "../types";
import { telegramRequest } from "./http";

export function createTelegramTools(service: IntegrationService) {
  const chatId = z.string().min(1).max(128);
  return [
    defineTool({ name: "telegram:get_bot", connector: "telegram", description: "Verifikasi identitas bot Telegram yang terhubung.", schema: z.object({}).strict(), parameters: objectSchema({}), execute: (_, run, signal) => telegramRequest(service, run.userId, "getMe", undefined, signal) }),
    defineTool({ name: "telegram:get_chat", connector: "telegram", description: "Baca informasi chat yang dapat diakses bot menggunakan chatId atau @username.", schema: z.object({ chatId }).strict(), parameters: objectSchema({ chatId: stringField }, ["chatId"]), execute: (args, run, signal) => telegramRequest(service, run.userId, "getChat", { chat_id: args.chatId }, signal) }),
    defineTool({ name: "telegram:send_message", connector: "telegram", permission: "send", description: "Kirim pesan Telegram melalui bot hanya sesuai permintaan eksplisit pengguna, dengan tujuan dan teks jelas. Memerlukan izin kirim.", schema: z.object({ chatId, text: z.string().min(1).max(4096) }).strict(), parameters: objectSchema({ chatId: stringField, text: stringField }, ["chatId", "text"]), execute: (args, run, signal) => telegramRequest(service, run.userId, "sendMessage", { chat_id: args.chatId, text: args.text }, signal) }),
  ];
}
