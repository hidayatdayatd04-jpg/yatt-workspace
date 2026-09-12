import { readCodeArtifact, type CodeArtifactData } from "./code-artifact-data";
import type { ResearchResult } from "@shared/index";
import type { ActivityEventDTO, RunEventDTO } from "./chat-hooks";
import { buildPipeline, type PipelineStep } from "./ToolActivity";

export type TimelineBlock =
  | { kind: "artifact"; key: string; artifact: CodeArtifactData; writing?: boolean }
  | { kind: "text"; key: string; text: string }
  | { kind: "reasoning"; key: string; text: string; durationMs?: number; ended?: boolean }
  | { kind: "file"; key: string; path: string }
  | { kind: "tool"; key: string; step: PipelineStep; steps: PipelineStep[] }
  | {
      kind: "research";
      key: string;
      callId: string;
      activityLabel?: string;
      status: "running" | "completed" | "failed";
      research: ResearchResult | null;
    };

/** One chronology for both live SSE and the persisted assistant message. */
export function buildRunTimeline(events: RunEventDTO[], live = false): TimelineBlock[] {
  const unique = [...new Map(events.map((e) => [e.seq, e])).values()].sort((a, b) => a.seq - b.seq);
  const activities: ActivityEventDTO[] = unique.map((e) => ({
    ...e,
    id: `event-${e.seq}`,
    conversationId: "",
    activityId: String(e.payload.callId ?? e.seq),
    parentId: null,
    actor: "ai",
    createdAt: "",
    payload: { ...e.payload, tool: e.payload.name ?? e.payload.tool },
  }));
  const { steps } = buildPipeline(activities, live);
  const byKey = new Map(steps.map((step) => [step.key, step]));
  const blocks: TimelineBlock[] = [];
  const artifacts = new Map<string, Extract<TimelineBlock, { kind: "artifact" }>>();
  const researchByCall = new Map<string, Extract<TimelineBlock, { kind: "research" }>>();

  for (const e of unique) {
    const key = `event-${e.seq}`;
    if (e.type === "reasoning.delta") {
      // Dukung separator lama dan teks hasil penggabungan event saat persist.
      // Sisa marker [[PIKIR]] dibuang — blok reasoning tidak pernah menampilkannya.
      const raw = String(e.payload.text ?? "").replace(/\[\[\/?PIKIR\]\]/g, "");
      const last = blocks.at(-1);
      if (e.payload.segmentStart || last?.kind !== "reasoning") {
        blocks.push({ kind: "reasoning", key, text: e.payload.segmentStart && raw === "\n\n" ? "" : raw });
      } else if (raw) {
        last.text += raw;
      }
      const current = blocks.at(-1);
      if (current?.kind === "reasoning") {
        if (typeof e.payload.durationMs === "number") current.durationMs = e.payload.durationMs;
        if (e.payload.segmentEnd) current.ended = true;
      }
      continue;
    }
    if (e.type === "message.delta") {
      const text = String(e.payload.text ?? "");
      const last = blocks.at(-1);
      if (last?.kind === "text") {
        last.text += text;
      } else if (text) {
        blocks.push({ kind: "text", key, text });
      }
      continue;
    }
    const p = e.payload as Record<string, unknown>;
    const artifact = e.type === "tool.completed" ? readCodeArtifact(p.artifact) : null;
    const artifactId = String(p.callId ?? key);
    if (e.type === "artifact.delta") {
      const existing = artifacts.get(artifactId);
      if (existing) existing.artifact.code += String(p.text ?? "");
      else {
        const block: Extract<TimelineBlock, { kind: "artifact" }> = { kind: "artifact", key: `artifact-${artifactId}`, writing: live,
          artifact: { path: String(p.path ?? ""), language: String(p.language ?? ""), code: String(p.text ?? "") } };
        artifacts.set(artifactId, block);
        blocks.push(block);
      }
      continue;
    }
    if (artifact) {
      const existing = artifacts.get(artifactId);
      if (existing) { existing.artifact = artifact; existing.writing = false; }
      else blocks.push({ kind: "artifact", key: `artifact-${artifactId}`, artifact });
    }
    // File hasil kerja (office/zip/dll) → tombol unduh dari workspace.
    if (e.type === "tool.completed" && typeof p.fileDownload === "string" && p.fileDownload) {
      blocks.push({ kind: "file", key: `file-${key}`, path: p.fileDownload });
    }
    const tool = String(p.tool ?? p.name ?? "");
    // Deep Research (web:) tidak masuk pipeline router — dirender sebagai
    // kartu sumber tersendiri (ResearchCard) pada posisi kronologisnya.
    if (tool === "web:search") {
      const callId = String(p.callId ?? key);
      const activityLabel = typeof p.activityLabel === "string" ? p.activityLabel.slice(0, 120) : undefined;
      if (e.type === "tool.preparing" || e.type === "tool.started") {
        if (researchByCall.has(callId)) {
          if (activityLabel) researchByCall.get(callId)!.activityLabel = activityLabel;
          continue;
        }
        const block: TimelineBlock = { kind: "research", key, callId, activityLabel, status: "running", research: null };
        researchByCall.set(callId, block);
        blocks.push(block);
      } else if (e.type === "tool.completed" || e.type === "tool.failed") {
        const research = p.research && typeof p.research === "object" ? (p.research as ResearchResult) : null;
        const status = e.type === "tool.completed" ? ("completed" as const) : ("failed" as const);
        const existing = researchByCall.get(callId);
        if (existing) {
          existing.status = status;
          existing.activityLabel = activityLabel ?? existing.activityLabel;
          existing.research = research;
        } else {
          const block: TimelineBlock = { kind: "research", key, callId, activityLabel, status, research };
          researchByCall.set(callId, block);
          blocks.push(block);
        }
      }
      continue;
    }
    const step = byKey.get(key);
    if (step) {
      const last = blocks.at(-1);
      if (last?.kind === "tool") {
        if (!last.steps.some((s) => s.key === step.key)) {
          last.steps.push(step);
        }
      } else {
        blocks.push({ kind: "tool", key, step, steps: [step] });
      }
    }
  }
  return blocks;
}
