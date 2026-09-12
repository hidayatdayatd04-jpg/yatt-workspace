import { useEffect, useState } from "react";
import { Cpu } from "@/components/icons";

const LOGO_BASE = "https://models.dev/logos";

function providerLogoUrl(logoId: string): string {
  return `${LOGO_BASE}/${logoId}.svg`;
}

/**
 * Petakan provider ke logo-id models.dev.
 * - gemini -> google
 * - openrouter -> openrouter
 * - custom -> openrouter (sesuai permintaan)
 * - custom yang namanya mengandung lab dikenal (openai/anthropic/dll) ikut logo lab tersebut.
 */
export function providerLogoId(provider: { kind?: string; id?: string; name?: string }): string {
  const hay = `${provider.id ?? ""} ${provider.name ?? ""} ${provider.kind ?? ""}`.toLowerCase();
  if (hay.includes("gemini") || hay.includes("google")) return "google";
  if (hay.includes("openrouter")) return "openrouter";
  if (hay.includes("openai") || hay.includes("gpt-")) return "openai";
  if (hay.includes("anthropic") || hay.includes("claude")) return "anthropic";
  if (hay.includes("deepseek")) return "deepseek";
  if (hay.includes("mistral") || hay.includes("mixtral")) return "mistral";
  if (hay.includes("meta") || hay.includes("llama")) return "meta";
  if (hay.includes("qwen") || hay.includes("alibaba")) return "alibaba";
  if (hay.includes("grok") || hay.includes("xai")) return "xai";
  if (hay.includes("cohere")) return "cohere";
  if (hay.includes("microsoft") || hay.includes("phi-")) return "microsoft";
  if (provider.kind === "gemini") return "google";
  if (provider.kind === "openrouter") return "openrouter";
  // custom default
  return "openrouter";
}

export function ProviderLogo({
  logoId,
  alt,
  className,
}: {
  logoId: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [logoId]);
  // Kotak 16px tetap + object-contain: semua logo (viewBox berbeda-beda) tampil sama besar.
  return (
    <span className={`flex size-4 shrink-0 items-center justify-center overflow-hidden ${className ?? ""}`} aria-hidden={alt === undefined ? true : undefined}>
      {failed ? (
        <Cpu className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <img
          src={providerLogoUrl(logoId)}
          alt={alt ?? logoId}
          width={16}
          height={16}
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-4 w-4 object-contain"
        />
      )}
    </span>
  );
}
