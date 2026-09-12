/**
 * Taksonomi error tool terstandar. Tool melempar ToolResultError → registry
 * menerjemahkan jadi {ok:false, error:{code,message,retryable,guidance}}.
 * Pesan guidance mengarahkan model ke tindakan korektif, bukan retry buta.
 */
export type ToolErrorCode =
  | "ARCHIVE_LIMIT_EXCEEDED"
  | "FILE_NOT_FOUND"
  | "PATH_OUTSIDE_WORKSPACE"
  | "FILE_CHANGED"
  | "COMMAND_NOT_FOUND"
  | "COMMAND_FAILED"
  | "COMMAND_TIMEOUT"
  | "PROCESS_NOT_FOUND"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "DEPENDENCY_MISSING"
  | "USER_APPROVAL_REQUIRED"
  | "TOOL_NOT_ALLOWED"
  | "TOOL_TIMEOUT"
  | "CANCELLED";

const RETRYABLE_TOOL_ERRORS: ReadonlySet<string> = new Set(["NETWORK_ERROR", "HTTP_ERROR", "TOOL_TIMEOUT"]);

export class ToolResultError extends Error {
  readonly code: ToolErrorCode | "TOOL_FAILED" | "VALIDATION_FAILED";
  readonly retryable: boolean;
  readonly guidance: string | null;

  constructor(code: ToolErrorCode | "TOOL_FAILED" | "VALIDATION_FAILED", message: string, opts: { retryable?: boolean; guidance?: string } = {}) {
    super(message);
    this.name = "ToolResultError";
    this.code = code;
    this.retryable = opts.retryable ?? RETRYABLE_TOOL_ERRORS.has(code);
    this.guidance = opts.guidance ?? null;
  }
}

/** Bentuk body error standar yang dikirim ke model sebagai output tool. */
export function toolErrorBody(err: unknown): { ok: false; error: { code: string; message: string; retryable: boolean; guidance: string | null } } {
  if (err instanceof ToolResultError) {
    return { ok: false, error: { code: err.code, message: err.message, retryable: err.retryable, guidance: err.guidance } };
  }
  const code = err instanceof Error && (err as { code?: string }).code === "ENOENT" ? "FILE_NOT_FOUND" : "TOOL_FAILED";
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: { code, message, retryable: false, guidance: null } };
}
