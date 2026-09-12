import type { RunEventDTO } from "./chat-hooks";
import { readCodeArtifact, type CodeArtifactData } from "./code-artifact-data";

/** Artefak final valid menjadi delta tampilan; peristiwa asli tetap terakhir. */
export function artifactTypingEvent(ev: RunEventDTO): RunEventDTO | null {
  const artifact = ev.type === "tool.completed" ? readCodeArtifact(ev.payload.artifact) : null;
  return artifact?.code ? { ...ev, seq: ev.seq - 0.5, type: "artifact.delta",
    payload: { callId: ev.payload.callId, path: artifact.path, language: artifact.language, text: artifact.code } } : null;
}

export function completedArtifacts(events: RunEventDTO[]): CodeArtifactData[] {
  const files = new Map<string, CodeArtifactData>();
  for (const ev of events) {
    const artifact = ev.type === "tool.completed" ? readCodeArtifact(ev.payload.artifact) : null;
    if (artifact) files.set(artifact.path, artifact);
  }
  return [...files.values()];
}
