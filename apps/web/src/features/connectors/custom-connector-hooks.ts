import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface CustomConnectorDTO {
  id: string;
  name: string;
  serverUrl: string;
  status: "connected" | "unverified" | "error";
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export function useCustomConnectors() {
  return useQuery({
    queryKey: ["custom-connectors"],
    queryFn: () => apiFetch<{ connectors: CustomConnectorDTO[] }>("/api/custom-connectors"),
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateCustomConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; serverUrl: string }) =>
      apiFetch<{ connector: CustomConnectorDTO }>("/api/custom-connectors", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-connectors"] }),
  });
}

export function useDeleteCustomConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/api/custom-connectors/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-connectors"] }),
  });
}
