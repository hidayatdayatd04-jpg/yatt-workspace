import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IntegrationDTO, IntegrationKind, IntegrationSettings } from "@shared/index";
import { apiFetch } from "@/lib/api";

export function useIntegrations() {
  return useQuery({ queryKey: ["integrations"], queryFn: () => apiFetch<{ integrations: IntegrationDTO[]; shellAvailable: boolean }>("/api/integrations"), staleTime: 10000, refetchOnWindowFocus: true });
}
export function useSaveIntegration() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ kind, ...settings }: IntegrationSettings & { kind: IntegrationKind }) => apiFetch<{ integration: IntegrationDTO }>(`/api/integrations/${kind}`, { method: "PUT", body: JSON.stringify(settings) }), onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }) });
}
export function useTestIntegration() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (kind: IntegrationKind) => apiFetch(`/api/integrations/${kind}/test`, { method: "POST" }), onSettled: () => qc.invalidateQueries({ queryKey: ["integrations"] }) });
}

export interface GoogleAccountState {
  connected: boolean;
  email: string | null;
  scopes: string[];
  expiryMs: number | null;
  enabled: boolean;
}

export function useGoogleAccount() {
  return useQuery({
    queryKey: ["google-account"],
    queryFn: () => apiFetch<{ account: GoogleAccountState; services: Record<string, IntegrationDTO> }>("/api/integrations/google/status"),
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useGoogleConfig() {
  return useQuery({
    queryKey: ["google-config"],
    queryFn: () => apiFetch<{ hasEnvClient: boolean; redirectHint: string; scopes: string[] }>("/api/integrations/google/config"),
    staleTime: 60000,
  });
}

export function useGoogleAuthUrl() {
  return useMutation({
    mutationFn: (input: { clientId?: string; clientSecret?: string; redirectUri?: string }) =>
      apiFetch<{ url: string; redirectUri: string }>("/api/integrations/google/auth-url", { method: "POST", body: JSON.stringify(input) }),
  });
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/api/integrations/google", { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); qc.invalidateQueries({ queryKey: ["google-account"] }); },
  });
}
