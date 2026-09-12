import type { ComponentType } from "react";
import {
  Activity, Archive, Calendar, Database, FileText, Globe, HardDrive,
  ImagePlus, Layers, Mail, Network, Pencil, Plug, Search, Send,
  ShieldCheck, TerminalSquare, Trash2,
  type IconProps,
} from "@/components/icons";

/**
 * Ikon per jenis aksi tool — menggantikan ikon centang generik pada pipeline:
 * read → file, write → pena, shell → terminal, extract → arsip, delete → tempat
 * sampah, web → globe, dan seterusnya.
 */
const RULES: readonly (readonly [RegExp, ComponentType<IconProps>])[] = [
  [/gmail|mail/, Mail],
  [/calendar|agenda/, Calendar],
  [/drive/, HardDrive],
  [/telegram|send_message/, Send],
  [/delete|remove_|revoke|disconnect|rollback/, Trash2],
  [/write_file|create_text_file|create_|draft|edit|rename|enable|disable|update|apply_patch|replace_text|import/, Pencil],
  [/shell|execute|command|run_script|start_process|run_routeros|start/, TerminalSquare],
  [/extract|zip|archive/, Archive],
  [/vision|describe|ocr|analyze/, ImagePlus],
  [/statistics|query_csv|inspect_csv|parse_json|query|data:/, Database],
  [/verify|safe_mode|approval/, ShieldCheck],
  [/connect_router|connect|login/, Plug],
  [/routeros|router|ssh|network/, Network],
  [/search|find|list_|scan/, Search],
  [/fetch_url|web:/, Globe],
  [/read_file|read_document|get_file|read_attachment|list_attachments|get_attachment|docs:/, FileText],
  [/git/, Layers],
];

export function toolIcon(tool: string): ComponentType<IconProps> {
  const n = tool.toLowerCase();
  for (const [pattern, icon] of RULES) if (pattern.test(n)) return icon;
  return Activity;
}