import { queueTerminalCommand } from "./terminal/submit";
import { executeTerminalCommand } from "./terminal/execute";
import type { TerminalDeps } from "./terminal/types";

export { openTerminalSession } from "./terminal/session";

export async function submitTerminalCommand(
  deps: TerminalDeps,
  input: { userId: string; sessionId: string; command: string; conversationId?: string | null },
) {
  const queued = await queueTerminalCommand(deps, input);

  // Background execution (POST returns commandId immediately; output via polling/events).
  void executeTerminalCommand(deps, { userId: input.userId, conversationId: input.conversationId }, queued);

  return { commandId: queued.cmdRowId, status: "queued" as const };
}
