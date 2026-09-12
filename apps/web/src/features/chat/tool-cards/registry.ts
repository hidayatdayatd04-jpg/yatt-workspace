import type { ComponentType } from "react";
import {
  Activity, Archive, Calendar, Database, FileText, Globe, HardDrive,
  ImagePlus, Layers, Mail, Network, Pencil, Plug, Search, Send,
  ShieldCheck, TerminalSquare, Trash2,
  type IconProps,
} from "@/components/icons";
import { toolIcon } from "../tool-activity/tool-icons";

/** Kategori menentukan preview LEVEL 2; tool baru otomatis generic. */
export type ToolCategory =
  | "terminal" | "file" | "search" | "image" | "table" | "json"
  | "router" | "drive" | "mail" | "calendar" | "docs" | "code" | "generic";

interface ToolMetadata {
  icon: ComponentType<IconProps>;
  category: ToolCategory;
}

const RULES: readonly (readonly [RegExp, ToolMetadata])[] = [
  [/gmail|mail/, { icon: Mail, category: "mail" }],
  [/calendar|agenda/, { icon: Calendar, category: "calendar" }],
  [/drive/, { icon: HardDrive, category: "drive" }],
  [/gdocs|google.docs|docs:/, { icon: FileText, category: "docs" }],
  [/sheets/, { icon: Database, category: "table" }],
  [/slides/, { icon: Layers, category: "docs" }],
  [/telegram|send_message/, { icon: Send, category: "generic" }],
  [/delete|remove_|revoke|disconnect|rollback/, { icon: Trash2, category: "generic" }],
  [/shell|execute|command|run_script|start_process|run_routeros|start/, { icon: TerminalSquare, category: "terminal" }],
  [/extract|zip|archive/, { icon: Archive, category: "file" }],
  [/vision|describe|ocr|analyze/, { icon: ImagePlus, category: "image" }],
  [/statistics|query_csv|inspect_csv|read_sheet|query_json/, { icon: Database, category: "table" }],
  [/parse_json|validate_json|format_json|data:/, { icon: Database, category: "json" }],
  [/verify|safe_mode|approval/, { icon: ShieldCheck, category: "generic" }],
  [/connect_router|connect|login/, { icon: Plug, category: "router" }],
  [/mt:|routeros|router|ssh|network|mikrotik/, { icon: Network, category: "router" }],
  [/search|find|list_|scan/, { icon: Search, category: "search" }],
  [/fetch_url|web:/, { icon: Globe, category: "search" }],
  [/read_file|read_document|get_file|read_attachment|list_attachments|write_file|create_text_file|import_attachment/, { icon: FileText, category: "file" }],
  [/apply_patch|replace_text|write_file/, { icon: Pencil, category: "code" }],
  [/git/, { icon: Layers, category: "code" }],
];

/** Metadata tool berbasis regex fqName — tool tak dikenal jatuh ke generic. */
export function toolMetadata(toolName: string): ToolMetadata {
  const n = toolName.toLowerCase();
  for (const [pattern, meta] of RULES) if (pattern.test(n)) return meta;
  return { icon: Activity, category: "generic" };
}

/** Ikon tool untuk header card — dipakai bersama toolIcon lama sebagai fallback. */
export function cardIcon(toolName: string): ComponentType<IconProps> {
  return toolMetadata(toolName).icon ?? toolIcon(toolName);
}
