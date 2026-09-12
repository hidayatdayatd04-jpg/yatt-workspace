import { Check } from "@/components/icons";
import {
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { REASONING_EFFORTS, reasoningEffortHint, reasoningEffortLabel } from "@shared/index";
import type { ComposerReasoning } from "./use-composer-reasoning";

/** Effort native berada di menu model; model biasa tidak diberi klaim reasoning. */
export function ReasoningPicker({ reasoning }: { reasoning: ComposerReasoning }) {
  if (!reasoning.nativeSupported) return null;
  const current = reasoning.effort ?? "medium";
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-3 rounded-xl px-3 py-3 text-sm focus:bg-muted/60" aria-label="Upaya penalaran">
        <span className="flex-1">Upaya penalaran</span>
        <span className="mr-1 text-muted-foreground">{reasoningEffortLabel(current)}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={8} collisionPadding={12} className="w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 p-1.5 shadow-lg">
        {(["off", ...REASONING_EFFORTS] as const).map((level) => (
          <DropdownMenuItem key={level} onSelect={() => reasoning.setEffort(level)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 focus:bg-muted/60">
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{reasoningEffortLabel(level)}</span>
              <span className="block text-xs text-muted-foreground">{reasoningEffortHint(level)}</span>
            </span>
            {current === level && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
