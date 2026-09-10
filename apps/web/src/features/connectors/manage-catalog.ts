import { Server, Folder, Mail, Calendar } from "@/components/icons";

export type VisibleKind = "mikrotik" | "drive" | "gmail" | "calendar";
export type ManageTab = "mine" | "discover";
export type ManageFilter = "all" | "connected" | "not-connected";

export const VISIBLE: { kind: VisibleKind; name: string; desc: string; type: string; Icon: typeof Server }[] = [
  { kind: "mikrotik", name: "MikroTik Server", desc: "Connect routers and manage network config safely", type: "Router", Icon: Server },
  { kind: "drive", name: "Google Drive", desc: "Search, read, and upload files instantly", type: "Web", Icon: Folder },
  { kind: "gmail", name: "Gmail", desc: "Draft replies, summarize threads, & search your inbox", type: "Web", Icon: Mail },
  { kind: "calendar", name: "Google Calendar", desc: "Manage your schedule and coordinate meetings", type: "Web", Icon: Calendar },
];

export const POPULAR: VisibleKind[] = ["gmail", "drive", "calendar"];
export const FILTERS: ManageFilter[] = ["all", "connected", "not-connected"];

export function filterLabel(f: ManageFilter) {
  return f === "all" ? "All" : f === "connected" ? "Connected" : "Not connected";
}
