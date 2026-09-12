import type { ComponentType } from "react";
import { MikrotikIcon, GoogleDriveIcon, GmailIcon, GoogleCalendarIcon, GoogleDocsIcon, GoogleSheetsIcon, GoogleSlidesIcon } from "@/components/icons";

export type VisibleKind = "mikrotik" | "drive" | "gmail" | "calendar" | "docs" | "sheets" | "slides";
export type ManageTab = "mine" | "discover";
export type ManageFilter = "all" | "connected" | "not-connected";

export const VISIBLE: { kind: VisibleKind; name: string; desc: string; type: string; Icon: ComponentType<{ className?: string; size?: number | string }> }[] = [
  { kind: "mikrotik", name: "MikroTik Server", desc: "Connect routers and manage network config safely", type: "Router", Icon: MikrotikIcon },
  { kind: "drive", name: "Google Drive", desc: "Search, read, and upload files instantly", type: "Web", Icon: GoogleDriveIcon },
  { kind: "docs", name: "Google Docs", desc: "Buat, baca, dan edit dokumen Google Docs dengan login akun tersendiri", type: "Web", Icon: GoogleDocsIcon },
  { kind: "sheets", name: "Google Sheets", desc: "Baca dan kelola spreadsheet Google Sheets dengan login akun tersendiri", type: "Web", Icon: GoogleSheetsIcon },
  { kind: "slides", name: "Google Slides", desc: "Baca dan kelola presentasi Google Slides dengan login akun tersendiri", type: "Web", Icon: GoogleSlidesIcon },
  { kind: "gmail", name: "Gmail", desc: "Draft replies, summarize threads, & search your inbox", type: "Web", Icon: GmailIcon },
  { kind: "calendar", name: "Google Calendar", desc: "Manage your schedule and coordinate meetings", type: "Web", Icon: GoogleCalendarIcon },
];

export const POPULAR: VisibleKind[] = ["gmail", "drive", "calendar"];
export const FILTERS: ManageFilter[] = ["all", "connected", "not-connected"];

export function filterLabel(f: ManageFilter) {
  return f === "all" ? "All" : f === "connected" ? "Connected" : "Not connected";
}
