import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Memastikan .env di root workspace termuat ke process.env
 * ketika API dijalankan dari dalam apps/api (contoh: bun run --cwd apps/api dev).
 */
export function ensureRootEnvLoaded() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      try {
        const text = readFileSync(file, "utf8");
        for (const line of text.split(/\r?\n/)) {
          const t = line.trim();
          if (!t || t.startsWith("#")) continue;
          const eq = t.indexOf("=");
          if (eq > 0) {
            const key = t.slice(0, eq).trim();
            let val = t.slice(eq + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            process.env[key] = val;
          }
        }
      } catch {
        /* abaikan jika gagal baca */
      }
      break;
    }
  }
}
