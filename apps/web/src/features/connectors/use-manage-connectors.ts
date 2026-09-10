import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { IntegrationKind } from "@shared/index";
import { useIntegrations, useSaveIntegration, useTestIntegration, useGoogleAccount } from "./integration-hooks";
import { VISIBLE, type ManageFilter, type ManageTab, type VisibleKind } from "./manage-catalog";

/** State + status konektor untuk panel Manage (dipakai semua sub-tampilan). */
export function useManageConnectors(props: { initialSelected?: VisibleKind | null; autoBrowse?: boolean }) {
  const data = useIntegrations();
  const save = useSaveIntegration();
  const test = useTestIntegration();
  const googleAccount = useGoogleAccount();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ManageTab>("mine");
  const [filter, setFilter] = useState<ManageFilter>("all");
  const [selected, setSelected] = useState<VisibleKind | null>(props.initialSelected ?? null);
  const [browseOpen, setBrowseOpen] = useState(!!props.autoBrowse);

  // Hasil redirect OAuth Google (?google=connected / =error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("google");
    if (flag === "connected") {
      const email = params.get("email");
      const service = params.get("service");
      const sName = service === "drive" ? "Google Drive" : service === "gmail" ? "Gmail" : service === "calendar" ? "Google Calendar" : "Akun Google";
      toast.success(email ? `${sName} (${email}) berhasil terhubung.` : `${sName} berhasil terhubung.`);
      void data.refetch();
      void googleAccount.refetch();
      params.delete("google"); params.delete("email"); params.delete("service"); params.delete("message");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    } else if (flag === "error") {
      toast.error(params.get("message") || "Login Google gagal. Coba lagi.");
      params.delete("google"); params.delete("service"); params.delete("message");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    }
  }, []);

  const states = data.data?.integrations ?? [];
  const stateOf = (kind: string) => states.find((s) => s.kind === kind);
  const isConnected = (kind: string) => {
    const s = stateOf(kind);
    return !!s?.configured && !!s?.enabled && s.status !== "error";
  };
  const hasError = (kind: string) => stateOf(kind)?.status === "error";
  const searched = VISIBLE.filter((v) => `${v.name} ${v.desc}`.toLowerCase().includes(query.toLowerCase()));
  const tableRows = searched.filter((v) => {
    if (filter === "all") return true;
    const c = isConnected(v.kind);
    return filter === "connected" ? c : !c;
  });

  function handleRowAction(kind: VisibleKind) {
    if (hasError(kind)) {
      test.mutate(kind as IntegrationKind, {
        onSuccess: () => toast.success("Koneksi berhasil diverifikasi."),
        onError: (err) => toast.error(err.message),
      });
      return;
    }
    setSelected(kind);
  }

  return { data, save, test, query, setQuery, tab, setTab, filter, setFilter, selected, setSelected, browseOpen, setBrowseOpen, stateOf, isConnected, hasError, searched, tableRows, handleRowAction };
}

export type ManageState = ReturnType<typeof useManageConnectors>;
