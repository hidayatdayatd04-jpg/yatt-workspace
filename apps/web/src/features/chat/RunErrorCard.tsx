import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, TriangleAlertIcon } from "@/components/icons";
import { runErrorHint, runErrorProgress, runErrorTitle, type RunErrorInfo } from "./run-error";

const COOLDOWN_CODES = new Set(["UPSTREAM_RATE_LIMITED", "UPSTREAM_QUOTA_EXHAUSTED", "UPSTREAM_TIMEOUT", "UPSTREAM_ERROR"]);
const COOLDOWN_SECS = 20;

/**
 * Kartu error run — tampilan khusus yang BERBEDA dari bubble chat.
 * Dipakai untuk kegagalan provider/limit/kuota agar detail error tidak
 * tercampur dengan jawaban AI. Satu tombol "Coba lagi" otomatis mengirim
 * "continue" agar run meneruskan sisa yang belum selesai (lihat resume
 * assist di backend), bukan mengulang dari nol.
 */
export function RunErrorCard(props: {
  error: RunErrorInfo;
  onRetry?: () => void;
}) {
  const { error } = props;
  const hint = runErrorHint(error.code);
  const progress = runErrorProgress(error);
  const needsCooldown = COOLDOWN_CODES.has(error.code);
  const [cooldown, setCooldown] = useState(needsCooldown ? COOLDOWN_SECS : 0);
  useEffect(() => {
    if (!needsCooldown) return;
    setCooldown(COOLDOWN_SECS);
    const t = setInterval(() => setCooldown((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(t);
  }, [error.code, needsCooldown]);
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3.5 dark:bg-rose-500/[0.1]"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
          <TriangleAlertIcon className="size-4 text-rose-600 dark:text-rose-400" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{runErrorTitle(error.code)}</p>
            <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-rose-600 dark:text-rose-400">
              {error.code}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">{error.reason}</p>
          {progress && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{progress}</p>}
          {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
          {props.onRetry && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl border-rose-500/30 text-xs hover:bg-rose-500/10"
                onClick={props.onRetry}
                disabled={cooldown > 0}
                title={cooldown > 0 ? `Tunggu ${cooldown} dtk sebelum mencoba lagi` : "Lanjutkan otomatis sisa pekerjaan yang belum selesai"}
              >
                <RotateCcw className="size-3.5" />
                <span>{cooldown > 0 ? `Coba lagi (${cooldown})` : "Coba lagi"}</span>
              </Button>
              {error.code === "UPSTREAM_AUTH_FAILED" && (
                <a href="/settings/providers" className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                  Buka Pengaturan Provider
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
