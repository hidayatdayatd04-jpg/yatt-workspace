import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface MemoryEntry {
  id: string;
  content: string;
  sourceConversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** CRUD memori lintas percakapan + instruksi khusus via REST. */
export function useMemoryTab() {
  const [memories, setMemories] = useState<MemoryEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);

  const load = useCallback(() => {
    fetch("/api/memories")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMemories(data.memories as MemoryEntry[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const text = String(data?.preferences?.aiInstructions ?? "");
        if (!cancelled) {
          setInstructions(text);
          setDraft(text);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveInstructions() {
    if (draft.length > 2000) {
      toast.error("Instruksi maksimal 2000 karakter.");
      return;
    }
    setSavingInstructions(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiInstructions: draft }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan.");
      const data = await res.json();
      setInstructions(String(data?.preferences?.aiInstructions ?? draft));
      toast.success("Instruksi khusus disimpan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSavingInstructions(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus.");
      setMemories((prev) => prev?.filter((m) => m.id !== id) ?? prev);
      toast.success("Memori dihapus.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm("Hapus semua memori lintas percakapan?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/memories", { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus.");
      setMemories([]);
      toast.success("Semua memori dihapus.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  }

  return { memories, busy, instructions, draft, setDraft, savingInstructions, saveInstructions, remove, clearAll };
}
