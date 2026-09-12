/**
 * Unified streaming chat interface for the agent loop, so the loop code is
 * provider-agnostic. Two implementations:
 *  - OpenAiCompatibleClient: real requests via the `openai` SDK against
 *    Gemini / OpenRouter / custom endpoints (user-configured).
 *  - MockProviderClient: deterministic responses for dev/test without any
 *    credentials — never claimed as a real integration.
 */

export type { ChatClient, ChatMessage, ChatToolCall, ChatToolDefinition, StreamEvent } from "./chat-client/types";

export { createOpenAiCompatibleClient } from "./chat-client/openai-stream";
export { createMockClient } from "./chat-client/mock";
