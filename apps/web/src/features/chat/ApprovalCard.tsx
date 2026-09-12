import type { ApprovalSpec } from "./approval-card";
import { useApprovalFlow } from "./approval-card/use-approval-flow";
import { useApprovalLogPanel } from "./approval-card/use-approval-log";
import { ApprovalPendingCard } from "./approval-card/ApprovalPendingCard";
import { ApprovalExecutedCard } from "./approval-card/ApprovalExecutedCard";
import { ApprovalRejectedCard } from "./approval-card/ApprovalRejectedCard";

interface Props {
  spec: ApprovalSpec;
  activeConnectionId?: string | null;
  conversationId?: string | null;
  onRejected?: (summary: string) => void;
}

function NoRouterNotice() {
  return (
    <div className="my-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
      Kartu persetujuan ini hanya berlaku untuk konfigurasi router, dan belum ada router yang terhubung. Untuk mengubah file atau dokumen (Word, Excel, PDF, PPT), minta langsung lewat chat — agent akan mengeksekusinya tanpa kartu persetujuan.
    </div>
  );
}

export function ApprovalCard({ spec, activeConnectionId, conversationId, onRejected }: Props) {
  const flow = useApprovalFlow(spec, { activeConnectionId, conversationId, onRejected });
  const log = useApprovalLogPanel(spec, flow.logs, flow.serverVerification);

  // Render when already executed (Executed / Verified State in the SAME Chat Output)
  if (flow.status === "executed") {
    return <ApprovalExecutedCard spec={spec} flow={flow} log={log} />;
  }

  // Render when rejected
  if (flow.status === "rejected") {
    return (
      <ApprovalRejectedCard spec={spec} expanded={flow.isExpanded} onToggle={() => flow.setIsExpanded(!flow.isExpanded)} />
    );
  }

  // Tanpa router aktif, kartu persetujuan router tidak bisa dieksekusi —
  // tampilkan penjelasan, bukan tombol yang pasti gagal.
  if (!activeConnectionId) return <NoRouterNotice />;

  // Render when idle or in_progress or failed
  return <ApprovalPendingCard spec={spec} flow={flow} />;
}
