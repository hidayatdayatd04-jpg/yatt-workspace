export function estimateTokens(chars: number): number {
  // Conservative: ~3.5 chars per token for mixed ID/EN + RouterOS output.
  return Math.ceil(chars / 3.5);
}
