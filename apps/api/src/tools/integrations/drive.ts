import type { IntegrationService } from "../../services/integrations";
import type { AgentTool } from "../types";
import { createDriveFileTools } from "./drive-files";

/** Kompatibilitas: seluruh tool Drive (file + Docs/Sheets/Slides) kini tinggal di modul terpisah. */
export function createDriveTools(service: IntegrationService): AgentTool[] {
  return [
    ...createDriveFileTools(service),
  ];
}
