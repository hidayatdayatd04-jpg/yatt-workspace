import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ActivityEventDTO } from "./types";

export function useConversationActivities(conversationId: string | null) {
  return useQuery({
    queryKey: ["activities", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await apiFetch<{ events: ActivityEventDTO[]; nextCursor: number | null }>(
        `/api/conversations/${conversationId}/activities?limit=200`,
      );
      return res.events;
    },
  });
}

export function useCompactionStatus(conversationId: string | null) {
  return useQuery({
    queryKey: ["compaction", conversationId],
    enabled: !!conversationId,
    refetchInterval: 4000,
    queryFn: async () => {
      const res = await apiFetch<{
        summary: { version: number; throughSeq: number; model: string | null } | null;
        jobs: { id: string; status: string; reason: string; error: string | null }[];
      }>(`/api/conversations/${conversationId}/compaction`);
      return res;
    },
  });
}

export function useStartCompaction(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ jobId: string; status: string }>(`/api/conversations/${conversationId}/compact`, {
        method: "POST",
        body: JSON.stringify({ reason: "manual" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compaction", conversationId] }),
  });
}
