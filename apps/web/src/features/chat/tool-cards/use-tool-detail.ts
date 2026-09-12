import { useQuery } from "@tanstack/react-query";
import type { ToolExecutionDetail } from "./types";

/** Detail eksekusi tool untuk expand LEVEL 2/3; di-fetch saat card dibuka. */
export function useToolDetail(runId: string | undefined, callId: string | undefined, enabled: boolean) {
  return useQuery<ToolExecutionDetail>({
    queryKey: ["tool-execution", runId, callId],
    queryFn: async () => {
      const res = await fetch(`/api/runs/${runId}/tools/${callId}`);
      if (!res.ok) throw new Error("Detail eksekusi tool tidak tersedia.");
      return (await res.json()) as ToolExecutionDetail;
    },
    enabled: enabled && !!runId && !!callId,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
