import type { ChatToolDefinition } from "../chat-client";
import type { NormalizedTool } from "../../policies/normalize";
import { isGreetingOnly } from "../intent";
import { hasBrowseIntent } from "./workspace-scope";
import { CONNECTION_CHECK_FQ, CONNECTION_CHECK_TOOL } from "../../tools/mikrotik/status";
import { toProviderTools } from "./provider-tools";
import { selectRelevantTools } from "./ranking";
import type { StartRunInput } from "./types";
import { WEB_SEARCH_TOOL } from "../../tools/general/web-search-definition";

export interface RunCatalog {
  greetingOnly: boolean;
  catalog: NormalizedTool[];
  providerTools: ChatToolDefinition[];
}

/**
 * no router bound → documentation tools only; router tools would fail
 * ownership checks anyway and waste a provider turn.
 * The connection probe is always offered — it is how the model verifies
 * live status instead of trusting (or refusing) chat claims.
 */
export async function buildRunCatalog(
  catalogSource: { getCatalog(mode: "read-only" | "write"): Promise<NormalizedTool[]> },
  input: StartRunInput,
): Promise<RunCatalog> {
  const greetingOnly = isGreetingOnly(input.userText);
  const fullCatalog = greetingOnly ? [] : input.mikrotikEnabled === false ? [WEB_SEARCH_TOOL] : [...(await catalogSource.getCatalog(input.policy.mode)), CONNECTION_CHECK_TOOL];
  const routerCatalog = input.connectionId && input.mikrotikEnabled !== false
    ? fullCatalog
    : fullCatalog.filter((t) => t.fqName.startsWith("docs:") || t.fqName.startsWith("web:") || t.fqName === CONNECTION_CHECK_FQ);
  const catalog = [...routerCatalog, ...(greetingOnly ? [] : input.additionalTools ?? [])];
  // Kunci anti-intip: daftar isi workspace hanya ditawarkan bila percakapan
  // ini sudah berkutat dengan file (riwayat/lampiran) atau pengguna memintanya
  // eksplisit. Tanpa itu model wajib bertanya dulu, bukan menebak dari disk.
  const canBrowse = !!input.workspaceScope?.browsingAuthorized || hasBrowseIntent(input.userText);
  // Kunci anti-intip juga menutup jalur pintas pencarian broad: search_files
  // dengan pattern ".*" setara list_files. Tanpa otorisasi browse, tool
  // pencarian workspace tidak ditawarkan.
  const browsedCatalog = canBrowse
    ? catalog
    : catalog.filter((t) => t.fqName !== "general:list_files" && t.fqName !== "general:search_files" && t.fqName !== "general:search_code");
  const providerTools = toProviderTools(selectRelevantTools(browsedCatalog, input.userText), input.userText);
  return { greetingOnly, catalog: browsedCatalog, providerTools };
}
