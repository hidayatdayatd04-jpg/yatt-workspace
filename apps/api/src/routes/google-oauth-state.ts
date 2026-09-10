export interface PendingAuth {
  userId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  targetService?: string;
  createdAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

/** State sekali pakai untuk callback OAuth (terikat userId, kedaluwarsa 10 mnt). */
export function createPendingStore() {
  const pending = new Map<string, PendingAuth>();
  function cleanup() {
    const now = Date.now();
    for (const [k, v] of pending) if (now - v.createdAt > STATE_TTL_MS) pending.delete(k);
  }
  function take(state: string): PendingAuth | null {
    const auth = pending.get(state) ?? null;
    if (state) pending.delete(state);
    if (!auth || Date.now() - auth.createdAt > STATE_TTL_MS) return null;
    return auth;
  }
  function peekOrigin(state: string): string {
    try {
      const uri = state ? pending.get(state)?.redirectUri : undefined;
      if (uri) return new URL(uri).origin;
    } catch {
      /* abaikan */
    }
    return "";
  }
  return {
    issue(auth: Omit<PendingAuth, "createdAt">) {
      cleanup();
      const state = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
      pending.set(state, { ...auth, createdAt: Date.now() });
      return state;
    },
    take,
    peekOrigin,
  };
}

export function resolveRedirectUri(input: string | undefined, fallbackEnv: string | undefined, reqUrl: string, appUrl?: string) {
  if (input?.trim()) return input.trim();
  if (fallbackEnv?.trim()) return fallbackEnv.trim();
  // Turunkan dari origin request; di dev frontend mem-proxy /api sehingga
  // callback satu origin dengan UI. Di prod API+web satu proses.
  try {
    const origin = appUrl?.trim() || new URL(reqUrl).origin;
    return `${origin.replace(/\/+$/, "")}/api/integrations/google/callback`;
  } catch {
    return "http://localhost:3000/api/integrations/google/callback";
  }
}
