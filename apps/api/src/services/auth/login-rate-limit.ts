import { AppError } from "../../lib/errors";

// In-memory login rate limit per key (IP + identifier bucket).
const loginAttempts = new Map<string, number[]>();
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export function checkLoginRateLimit(key: string): void {
  const now = Date.now();
  const cutoff = now - LOGIN_WINDOW_MS;
  const times = (loginAttempts.get(key) ?? []).filter((t) => t > cutoff);
  if (times.length >= LOGIN_MAX) {
    throw new AppError("RATE_LIMITED", "Terlalu banyak percobaan login. Tunggu beberapa menit.", 429);
  }
  times.push(now);
  loginAttempts.set(key, times);
}

export function clearLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}
