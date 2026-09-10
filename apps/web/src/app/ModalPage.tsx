import { useEffect } from "react";
import { X } from "@/components/icons";

/** Bingkai modal untuk halaman sekunder (settings, connectors, map, dsb)
 *  agar tampil sebagai pop-up di atas chat. */
export function ModalPage(props: {
  label: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { onClose } = props;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Dialog radix bersarang (browse/custom connector) punya overlay sendiri —
      // biarkan mereka yang menangani Escape.
      if (document.querySelector('[data-slot="dialog-overlay"]')) return;
      e.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={props.label}>
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      <div
        className={`relative flex min-h-0 w-full flex-col overflow-hidden rounded-none bg-background shadow-2xl ring-1 ring-border/60 sm:rounded-3xl ${props.wide ? "sm:max-w-6xl" : "sm:max-w-4xl"} h-full sm:h-[88svh]`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          title="Tutup"
          className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground backdrop-blur transition-all hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
        >
          <X className="size-4" />
        </button>
        <div className="flex min-h-0 flex-1 flex-col">{props.children}</div>
      </div>
    </div>
  );
}
