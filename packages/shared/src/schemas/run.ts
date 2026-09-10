/** Structured Deep Research payload for the chat canvas (web: tool results). */
export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchResult {
  query: string;
  answer: string | null;
  sources: ResearchSource[];
}
export interface ModelLimitStatus {
  status: "available" | "limited" | "error";
  observedAt: string;
  retryAt: string | null;
  requestsLimit: number | null;
  requestsRemaining: number | null;
  tokensLimit: number | null;
  tokensRemaining: number | null;
  /** Status RPD harian — hanya bila provider menyediakannya; null bila tak ada. */
  dailyLimit?: number | null;
  dailyRemaining?: number | null;
  dailyResetAt?: string | null;
  /** True bila observasi terakhir mengindikasikan kuota harian habis. */
  isDailyQuotaExhausted?: boolean;
}
