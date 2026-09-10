import { expect, test } from "bun:test";
import type { ChatCtx, ChatRouteDeps } from "./types";
import { buildVisionContext } from "./image-reader";
import type { VisionCandidate } from "../../agent/vision-settings-utils";

const candidate = (providerId: string, model: string): VisionCandidate => ({ providerId, model,
  providerKind: "custom", baseUrl: `https://${providerId}.test/v1`, apiKey: providerId });
const args = { images: [{ name: "router.png", mime: "image/png", dataUrl: "data:image/png;base64,AA==" }],
  modelForVision: "gpt-4o", cfg: { kind: "custom" as const, baseUrl: "https://primary.test", model: "gpt-4o", apiKey: "primary" },
  userId: "user", runId: "run", conversationId: "conversation", policyMode: "read-only" as const };
function context(deps: Partial<ChatRouteDeps>): ChatCtx {
  return { deps: deps as ChatRouteDeps, backgroundRuns: new Map(), runTimesByUser: new Map() };
}
test("image reader falls through errors, empty output, another provider, primary, then general fallback", async () => {
  const attempted: string[] = [];
  const ctx = context({
    getVisionCandidates: async () => [candidate("first", "gpt-4o-mini"), candidate("first", "gpt-4o"), candidate("second", "gpt-4o")],
    getFallbackCandidates: async () => [{ ...candidate("disabled", "gpt-4o"), enabled: false },
      { ...candidate("text", "deepseek-chat"), enabled: true }, { ...candidate("general", "gpt-4o"), enabled: true }],
    makeClient: (cfg) => ({ modelLabel: cfg.model, async *stream(input) {
      attempted.push(`${cfg.apiKey}:${cfg.model}`);
      expect(input.messages[0]?.images).toEqual(args.images);
      if (attempted.length === 1) { yield { type: "text", text: "partial" }; throw new Error("429"); }
      if (cfg.apiKey === "general") yield { type: "text", text: "ether1 aktif" };
      yield { type: "done" };
    } }),
  });
  const result = await buildVisionContext(ctx, args);
  expect(attempted).toEqual(["first:gpt-4o-mini", "first:gpt-4o", "second:gpt-4o", "primary:gpt-4o", "general:gpt-4o"]);
  expect(result.note).toContain("ether1 aktif");
  expect(result.note).not.toContain("partial");
});
test("explicit vision success takes priority over a vision-capable primary", async () => {
  const attempted: string[] = [];
  const ctx = context({ getVisionCandidates: async () => [candidate("explicit", "gpt-4o-mini")],
    makeClient: (cfg) => ({ modelLabel: cfg.model, async *stream() {
      attempted.push(cfg.apiKey); yield { type: "text", text: "hasil" }; yield { type: "done" };
    } }) });
  expect((await buildVisionContext(ctx, args)).note).toContain("hasil");
  expect(attempted).toEqual(["explicit"]);
});
test("missing or failed vision returns honest failure, no images triggers no clients", async () => {
  const ctx = context({ makeClient: () => { throw new Error("unavailable"); } });
  expect((await buildVisionContext(ctx, args)).visionSupportedForInstruction).toBe(false);
  expect(await buildVisionContext(ctx, { ...args, images: [] })).toEqual({ visionImages: [], note: "" });
});
