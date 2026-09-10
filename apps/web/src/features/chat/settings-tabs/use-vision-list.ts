import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AiProviderDTO as VisionProviderDTO } from "../chat-hooks/types";

export function useVisionProviders() {
  return useQuery({
    queryKey: ["vision-providers"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const res = await apiFetch<{ providers: VisionProviderDTO[] }>("/api/vision-settings");
      return res.providers ?? [];
    },
  });
}

export function useSaveVisionProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      kind: "gemini" | "openrouter" | "custom";
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      models?: string[];
      activeModel?: string;
      enabled?: boolean;
    }) =>
      apiFetch<{ provider: VisionProviderDTO }>("/api/vision-settings", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vision-providers"] });
      qc.invalidateQueries({ queryKey: ["vision-settings"] });
    },
  });
}

export function useToggleVisionProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch<{ provider: VisionProviderDTO }>(`/api/vision-settings/${encodeURIComponent(id)}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vision-providers"] });
      qc.invalidateQueries({ queryKey: ["vision-settings"] });
    },
  });
}

export function useDeleteVisionProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/api/vision-settings/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vision-providers"] });
      qc.invalidateQueries({ queryKey: ["vision-settings"] });
    },
  });
}

export function fetchVisionModels(input: { providerId?: string; kind: string; baseUrl?: string; apiKey?: string }) {
  return apiFetch<{ models: { id: string; label?: string }[]; source: string }>("/api/vision-settings/models", {
    method: "POST", body: JSON.stringify(input),
  });
}
export function useActiveVisionModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, model }: { id: string; model: string }) => apiFetch(`/api/vision-settings/${encodeURIComponent(id)}/active-model`, {
      method: "PATCH", body: JSON.stringify({ model }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vision-providers"] }); },
  });
}
