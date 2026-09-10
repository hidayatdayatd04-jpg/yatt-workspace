import type { ComponentType } from "react";
import { MikrotikIcon, GoogleDriveIcon, GmailIcon, GoogleCalendarIcon } from "@/components/icons";
import type { IntegrationKind } from "@shared/index";

export type DirectoryKind = IntegrationKind | "mikrotik";
export type DirectoryFilter = "all" | "connected" | "not-connected";

export const DIRECTORY: { kind: DirectoryKind; name: string; desc: string; Icon: ComponentType<{ className?: string; size?: number | string }>; tile: string }[] = [
  { kind: "drive", name: "Google Drive", desc: "Search, read, and upload files instantly", Icon: GoogleDriveIcon, tile: "bg-emerald-500/10 border border-emerald-500/20" },
  { kind: "gmail", name: "Gmail", desc: "Draft replies, summarize threads, & search your inbox", Icon: GmailIcon, tile: "bg-rose-500/10 border border-rose-500/20" },
  { kind: "calendar", name: "Google Calendar", desc: "Manage your schedule and coordinate meetings", Icon: GoogleCalendarIcon, tile: "bg-sky-500/10 border border-sky-500/20" },
  { kind: "mikrotik", name: "MikroTik Server", desc: "Connect routers, inspect network, manage config safely", Icon: MikrotikIcon, tile: "bg-amber-500/10 border border-amber-500/20" },
];
