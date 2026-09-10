import type { IntegrationService } from "../../services/integrations";

export type GoogleKind = "drive" | "gmail" | "calendar" | "google";

export async function boundedJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(response.status === 401 || response.status === 403 ? "Autentikasi atau scope connector ditolak. Periksa kredensial dan izin API di Connectors." : `Layanan connector gagal (HTTP ${response.status}). Jangan ulangi tindakan pengiriman tanpa verifikasi.`);
  }
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2_000_000) throw new Error("Respons connector melebihi batas 2 MB.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

function isFresh(expiryMs?: number) {
  return typeof expiryMs === "number" && Number.isFinite(expiryMs) && Date.now() < expiryMs - 60_000;
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string, signal?: AbortSignal) {
  const result = await boundedJson("https://oauth2.googleapis.com/token", {
    method: "POST", signal, headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
  if (typeof result.access_token !== "string") throw new Error("Google tidak mengembalikan access token.");
  return { accessToken: result.access_token as string, expiresIn: typeof result.expires_in === "number" ? result.expires_in as number : undefined };
}

export async function googleToken(service: IntegrationService, userId: string, kind: GoogleKind, signal?: AbortSignal, opts: { forceRefresh?: boolean } = {}) {
  const c = await service.credentials(userId, kind === "google" ? "google" : kind);
  if (!opts.forceRefresh && c.accessToken && c.expiryMs && isFresh(c.expiryMs)) return c.accessToken;
  if (c.refreshToken && c.clientId && c.clientSecret && (opts.forceRefresh || !c.accessToken || !isFresh(c.expiryMs))) {
    const refreshed = await refreshAccessToken(c.clientId, c.clientSecret, c.refreshToken, signal);
    // Persist agar panggilan berikutnya tidak refresh berulang; abaikan bila baris google belum ada (akun lama per-layanan).
    try { await service.updateGoogleAccessToken(userId, refreshed.accessToken, refreshed.expiresIn); } catch { /* abaikan */ }
    return refreshed.accessToken;
  }
  if (!opts.forceRefresh && c.accessToken) return c.accessToken;
  throw new Error("Token Google belum tersedia. Hubungkan akun Google di Connectors.");
}

function googleOrigin(kind: GoogleKind) {
  return kind === "gmail" ? "https://gmail.googleapis.com" : "https://www.googleapis.com";
}

export async function googleRequest(service: IntegrationService, userId: string, kind: GoogleKind, path: string, body?: unknown, signal?: AbortSignal, init?: { method?: string }) {
  const method = init?.method ?? (body === undefined ? "GET" : "POST");
  async function call(token: string) {
    return boundedJson(`${googleOrigin(kind)}${path}`, { method, signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined && method === "GET" ? {} : { body: body === undefined ? undefined : JSON.stringify(body) }) });
  }
  const token = await googleToken(service, userId, kind, signal);
  try {
    return await call(token);
  } catch (err) {
    // Sekali retry dengan refresh paksa bila kemungkinan token kedaluwarsa.
    if (err instanceof Error && (err.message.includes("401") || err.message.includes("Autentikasi"))) {
      try {
        const fresh = await googleToken(service, userId, kind, signal, { forceRefresh: true });
        if (fresh !== token) return await call(fresh);
      } catch { /* jatuhkan ke error awal */ }
    }
    throw err;
  }
}
export async function telegramRequest(service: IntegrationService, userId: string, method: "getMe" | "getChat" | "sendMessage", body?: unknown, signal?: AbortSignal) {
  const { botToken } = await service.credentials(userId, "telegram");
  if (!botToken || !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) throw new Error("Bot token Telegram tidak valid.");
  // Never propagate fetch errors: the Telegram URL itself contains the secret.
  try {
    const data = await boundedJson(`https://api.telegram.org/bot${botToken}/${method}`, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    if (!data.ok) throw new Error("Telegram menolak permintaan.");
    return data.result;
  } catch { throw new Error("Permintaan Telegram gagal. Periksa bot token, chat ID, dan akses bot; verifikasi sebelum mengirim ulang."); }
}
