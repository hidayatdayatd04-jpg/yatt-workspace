import { Server, Folder, Mail, Calendar } from "@/components/icons";
import type { IntegrationKind } from "@shared/index";

export type DirectoryKind = IntegrationKind | "mikrotik";
export type DirectoryFilter = "all" | "connected" | "not-connected";

export const DIRECTORY: { kind: DirectoryKind; name: string; desc: string; Icon: typeof Server; tile: string }[] = [
  { kind: "drive", name: "Google Drive", desc: "Search, read, and upload files instantly", Icon: Folder, tile: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  { kind: "gmail", name: "Gmail", desc: "Draft replies, summarize threads, & search your inbox", Icon: Mail, tile: "bg-rose-500/12 text-rose-600 dark:text-rose-400" },
  { kind: "calendar", name: "Google Calendar", desc: "Manage your schedule and coordinate meetings", Icon: Calendar, tile: "bg-sky-500/12 text-sky-600 dark:text-sky-400" },
  { kind: "mikrotik", name: "MikroTik Server", desc: "Connect routers, inspect network, manage config safely", Icon: Server, tile: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400" },
];
