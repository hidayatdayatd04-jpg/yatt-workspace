import { z } from "zod";

export const IntegrationKindSchema = z.enum(["mikrotik", "workspace", "google", "drive", "gmail", "calendar", "docs", "sheets", "slides", "telegram"]);
export type IntegrationKind = z.infer<typeof IntegrationKindSchema>;
export const GOOGLE_BASE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;
export const GOOGLE_SERVICE_SCOPES: Record<"drive" | "gmail" | "calendar" | "docs" | "sheets" | "slides", readonly string[]> = {
  drive: ["https://www.googleapis.com/auth/drive"],
  gmail: ["https://www.googleapis.com/auth/gmail.modify"],
  calendar: ["https://www.googleapis.com/auth/calendar"],
  // Docs/Sheets/Slides: scope granular per layanan agar token benar-benar terpisah
  // (tidak memakai scope drive penuh milik connector Drive).
  docs: ["https://www.googleapis.com/auth/documents"],
  sheets: ["https://www.googleapis.com/auth/spreadsheets"],
  slides: ["https://www.googleapis.com/auth/presentations"],
};
export const GOOGLE_SCOPES = [
  ...GOOGLE_BASE_SCOPES,
  ...GOOGLE_SERVICE_SCOPES.drive,
  ...GOOGLE_SERVICE_SCOPES.gmail,
  ...GOOGLE_SERVICE_SCOPES.calendar,
] as const;
export const GOOGLE_SERVICES: IntegrationKind[] = ["drive", "gmail", "calendar", "docs", "sheets", "slides"];

export const IntegrationSettingsSchema = z.object({
  enabled: z.boolean(),
  allowWrite: z.boolean().default(false),
  allowSend: z.boolean().default(false),
  allowShell: z.boolean().default(false),
  credentials: z.object({
    accessToken: z.string().trim().max(8192).optional(),
    expiryMs: z.number().int().positive().max(9_999_999_999_999).optional(),
    accountEmail: z.string().trim().email().max(254).optional(),
    scopes: z.array(z.string().trim().max(256)).max(32).optional(),
    clientId: z.string().trim().max(512).optional(),
    clientSecret: z.string().trim().max(512).optional(),
    refreshToken: z.string().trim().max(8192).optional(),
    botToken: z.string().trim().max(256).optional(),
  }).strict().optional(),
}).strict();
export type IntegrationSettings = z.infer<typeof IntegrationSettingsSchema>;
export interface IntegrationDTO {
  kind: IntegrationKind;
  enabled: boolean;
  configured: boolean;
  allowWrite: boolean;
  allowSend: boolean;
  allowShell: boolean;
  status: "disabled" | "ready" | "unverified" | "connected" | "error";
  accountEmail?: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}
export const INTEGRATION_CATALOG: { kind: IntegrationKind; name: string; description: string; category: string }[] = [
  { kind: "mikrotik", name: "MikroTik Server", description: "Hubungkan router lewat chat, periksa jaringan, dan kelola konfigurasi dengan Safe Mode.", category: "Jaringan" },
  { kind: "workspace", name: "Coding & files", description: "Baca dan tulis kode, kelola file, ekstrak ZIP, serta jalankan command di workspace agent.", category: "Workspace" },
  { kind: "google", name: "Google Account", description: "Login sekali dengan akun Google untuk menghubungkan Drive, Gmail, dan Kalender sekaligus.", category: "Produktivitas" },
  { kind: "drive", name: "Google Drive", description: "Cari file, baca dokumen, dan buat file teks di Google Drive.", category: "Produktivitas" },
  { kind: "docs", name: "Google Docs", description: "Buat, baca, dan edit dokumen Google Docs dengan login akun tersendiri.", category: "Produktivitas" },
  { kind: "sheets", name: "Google Sheets", description: "Baca dan kelola spreadsheet Google Sheets dengan login akun tersendiri.", category: "Produktivitas" },
  { kind: "slides", name: "Google Slides", description: "Baca dan kelola presentasi Google Slides dengan login akun tersendiri.", category: "Produktivitas" },
  { kind: "gmail", name: "Gmail", description: "Cari dan baca email, buat draft, lalu kirim pesan sesuai instruksi Anda.", category: "Komunikasi" },
  { kind: "calendar", name: "Google Calendar", description: "Lihat jadwal, cari slot kosong, buat dan hapus event kalender.", category: "Produktivitas" },
  { kind: "telegram", name: "Telegram", description: "Hubungkan bot, periksa chat, dan kirim pesan ke chat yang dapat diakses bot.", category: "Komunikasi" },
];
