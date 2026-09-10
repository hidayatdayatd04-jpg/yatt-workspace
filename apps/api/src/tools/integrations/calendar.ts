import { z } from "zod";
import type { IntegrationService } from "../../services/integrations";
import { defineTool, objectSchema, stringField } from "../types";
import { googleRequest } from "./http";

const dateTimeField = { type: "string", description: "RFC3339, mis. 2026-09-12T09:00:00+07:00 atau tanggal 2026-09-12 untuk all-day" };

export function createCalendarTools(service: IntegrationService) {
  return [
    defineTool({ name: "calendar:list_calendars", connector: "calendar", description: "Daftar kalender Google yang dapat diakses (ID dan nama). Gunakan calendarId untuk list/create event.", schema: z.object({}).strict(), parameters: objectSchema({}),
      execute: (_args, run, signal) => googleRequest(service, run.userId, "calendar", "/calendar/v3/users/me/calendarList?maxResults=25&fields=items(id,summary,primary)", undefined, signal) }),
    defineTool({ name: "calendar:list_events", connector: "calendar", description: "Lihat event kalender pada rentang waktu. Default 7 hari ke depan. timeMin/timeMax format RFC3339.", schema: z.object({ calendarId: z.string().max(256).default("primary"), timeMin: z.string().max(64).optional(), timeMax: z.string().max(64).optional(), query: z.string().max(500).optional(), maxResults: z.number().int().min(1).max(50).default(10) }).strict(), parameters: objectSchema({ calendarId: stringField, timeMin: dateTimeField, timeMax: dateTimeField, query: stringField, maxResults: { type: "number" } }),
      execute: (args, run, signal) => {
        const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: String(args.maxResults), fields: "items(id,summary,start,end,location,hangoutLink,attendees(email))" });
        params.set("timeMin", args.timeMin ?? new Date().toISOString());
        params.set("timeMax", args.timeMax ?? new Date(Date.now() + 7 * 86400000).toISOString());
        if (args.query) params.set("q", args.query);
        return googleRequest(service, run.userId, "calendar", `/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events?${params}`, undefined, signal);
      } }),
    defineTool({ name: "calendar:create_event", connector: "calendar", permission: "write", description: "Buat event kalender. Memerlukan izin tulis. Untuk all-day isi date saja (YYYY-MM-DD); selain itu isi dateTime dengan zona waktu.", schema: z.object({ calendarId: z.string().max(256).default("primary"), summary: z.string().min(1).max(500), description: z.string().max(5000).optional(), location: z.string().max(500).optional(), start: z.string().min(4).max(64), end: z.string().min(4).max(64), attendees: z.array(z.string().email().max(254)).max(20).optional(), timeZone: z.string().max(64).optional() }).strict(), parameters: objectSchema({ calendarId: stringField, summary: stringField, description: stringField, location: stringField, start: dateTimeField, end: dateTimeField, attendees: { type: "array" }, timeZone: stringField }, ["summary", "start", "end"]),
      execute: (args, run, signal) => {
        const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(args.start) && /^\d{4}-\d{2}-\d{2}$/.test(args.end);
        const body = { summary: args.summary, ...(args.description ? { description: args.description } : {}), ...(args.location ? { location: args.location } : {}),
          start: isAllDay ? { date: args.start } : { dateTime: args.start, ...(args.timeZone ? { timeZone: args.timeZone } : {}) },
          end: isAllDay ? { date: args.end } : { dateTime: args.end, ...(args.timeZone ? { timeZone: args.timeZone } : {}) },
          ...(args.attendees?.length ? { attendees: args.attendees.map((email) => ({ email })) } : {}) };
        return googleRequest(service, run.userId, "calendar", `/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events?fields=id,summary,start,end,hangoutLink`, body, signal);
      } }),
    defineTool({ name: "calendar:delete_event", connector: "calendar", permission: "write", description: "Hapus event kalender berdasarkan ID. Memerlukan izin tulis; tindakan destruktif, minta konfirmasi pengguna bila ragu.", schema: z.object({ calendarId: z.string().max(256).default("primary"), eventId: z.string().min(1).max(256) }).strict(), parameters: objectSchema({ calendarId: stringField, eventId: stringField }, ["eventId"]),
      execute: async (args, run, signal) => {
        await googleRequest(service, run.userId, "calendar", `/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.eventId)}`, undefined, signal, { method: "DELETE" }).catch((err) => {
          // DELETE sukses mengembalikan 204 (body kosong) — boundedJson melempar? Tidak: 204 ok + body kosong => {}.
          throw err;
        });
        return { ok: true, eventId: args.eventId };
      } }),
  ];
}
