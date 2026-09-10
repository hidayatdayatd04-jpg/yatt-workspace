import type { ConnectorService } from "../../../services/connector";

/** Baris koneksi milik user dari `connectors.requireOwned(... )()`. */
export type OwnedConnection = Awaited<ReturnType<ReturnType<ConnectorService["requireOwned"]>>>;

export interface ToolExecResult {
  ok: boolean;
  output: string;
  errorCode?: string;
}
