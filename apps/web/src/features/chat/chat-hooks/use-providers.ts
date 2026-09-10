import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PreferencesDTO } from "./types";

export { useAiProviders, useSaveAiProvider, useToggleAiProvider, useDeleteAiProvider } from "./use-ai-providers";

/** Auto-fetch model list using a transient key — key is never stored by the backend. */
export async function fetchProviderModels(input: {
  providerId?: string;
  kind: string;
  baseUrl?: string;
  apiKey?: string;
}): Promise<{ models: { id: string; label?: string }[] }> {
  return apiFetch<{ models: { id: string; label?: string }[] }>("/api/ai-provider/models", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res = await apiFetch<{ preferences: PreferencesDTO }>("/api/preferences");
      return res.preferences;
    },
  });
}

export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PreferencesDTO>) =>
      apiFetch<{ preferences: PreferencesDTO }>("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferences"] }),
  });
}
