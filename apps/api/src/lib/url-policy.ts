import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Validasi target egress untuk fetch tool: blok loopback, private, link-local
 * (termasuk metadata cloud 169.254.169.254), multicast, dan non-http(s).
 * Resolve-then-validate: hostname di-DNS dulu, SEMUA IP hasil resolve harus
 * lolos — mencegah bypass lewat hostname yang menunjuk IP internal.
 */
const BLOCKED_MESSAGE = "URL ditolak kebijakan egress (IP internal/loopback/link-local/non-HTTP diblokir).";

class UrlPolicyError extends Error {
  constructor(message = BLOCKED_MESSAGE) {
    super(message);
    this.name = "UrlPolicyError";
  }
}

function ipBlocked(ip: string): boolean {
  if (isIP(ip) === 6) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique local
    if (low.startsWith("ff")) return true; // multicast
    if (low.startsWith("::ffff:")) return ipBlocked(low.slice(7));
    return false;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + metadata endpoint
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast/reserved
  return false;
}

export interface ValidatedUrl {
  url: URL;
  host: string;
  port: number;
}

/** Validasi URL string + resolve DNS; throw UrlPolicyError bila ditolak. */
export async function validateEgressUrl(raw: string, opts: { maxBytes: number }): Promise<ValidatedUrl> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlPolicyError("URL tidak valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UrlPolicyError("Hanya http/https diizinkan.");
  if (raw.length > 2000) throw new UrlPolicyError("URL terlalu panjang.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) throw new UrlPolicyError("Hostname kosong.");
  if (isIP(host)) {
    if (ipBlocked(host)) throw new UrlPolicyError();
    return { url, host, port: Number(url.port || (url.protocol === "https:" ? 443 : 80)) };
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new UrlPolicyError();
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (records.length === 0 || records.some((r) => ipBlocked(r.address))) throw new UrlPolicyError();
  } catch (err) {
    if (err instanceof UrlPolicyError) throw err;
    throw new UrlPolicyError(`Resolusi DNS gagal untuk ${host}.`);
  }
  if (opts.maxBytes > 0) {
    // placeholder untuk keperluan masa depan
  }
  return { url, host, port: Number(url.port || (url.protocol === "https:" ? 443 : 80)) };
}
