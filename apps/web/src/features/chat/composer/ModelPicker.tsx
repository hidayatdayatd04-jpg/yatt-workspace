import { ChevronDown, Search, Settings2 } from "@/components/icons";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { reasoningEffortLabel } from "@shared/index";
import type { ComposerModel } from "./use-composer-model";
import type { ModelScroll } from "./use-model-scroll";
import type { ComposerReasoning } from "./use-composer-reasoning";
import { ReasoningPicker } from "./ReasoningPicker";
import { ModelList } from "./ModelList";
import { MODEL_MENU_CLASS, modelDisplayName } from "./model-display";

export function ModelPicker({ model, scroll, reasoning }: { model: ComposerModel; scroll: ModelScroll; reasoning: ComposerReasoning }) {
  if (model.availableModels.length === 0) return (
    <button type="button" onClick={model.goManageModels} className="h-9 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted" aria-label="Atur model AI">Atur model</button>
  );
  return (
    <DropdownMenu onOpenChange={(open) => { model.setModelMenuOpen(open); if (!open) model.setModelQuery(""); }}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Pilih model AI" title={`${model.effectiveProvider?.name} / ${model.effectiveModel}`}
          className="flex h-9 min-w-0 max-w-[min(52vw,320px)] items-center gap-1.5 rounded-lg px-2 text-sm text-foreground/75 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-[15px]">
          <span className="truncate">{modelDisplayName(model.effectiveModel)}</span>
          {reasoning.nativeSupported && reasoning.effort && <span className="shrink-0 text-muted-foreground">{reasoningEffortLabel(reasoning.effort)}</span>}
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={10} collisionPadding={12} className={MODEL_MENU_CLASS}>
        {model.availableModels.length > 5 && <div className="relative m-1 mb-2">
          <Search className="pointer-events-none absolute left-3 top-3 size-3.5 text-muted-foreground" />
          <input value={model.modelQuery} onChange={(e) => model.setModelQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key !== "Escape") e.stopPropagation(); }} placeholder="Cari model" aria-label="Cari model"
            className="h-9 w-full rounded-lg bg-muted/50 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>}
        <div className="relative">
          <div ref={scroll.modelScrollRef} onScroll={scroll.updateModelThumb}
            className="max-h-[min(320px,45vh)] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ModelList model={model} />
          </div>
          <div ref={scroll.modelTrackRef} onPointerDown={scroll.onModelTrackPointerDown} aria-hidden="true"
            className={`absolute right-0 top-1 bottom-1 flex w-1.5 justify-center ${scroll.modelThumb.visible ? "cursor-pointer" : "pointer-events-none"}`}>
            {scroll.modelThumb.visible && <div onPointerDown={scroll.onModelThumbPointerDown}
              style={{ top: scroll.modelThumb.top, height: scroll.modelThumb.height }} className="absolute w-1 rounded-full bg-foreground/15 hover:bg-foreground/30" />}
          </div>
        </div>
        {reasoning.nativeSupported && <><DropdownMenuSeparator className="mx-2 my-1" /><ReasoningPicker reasoning={reasoning} /></>}
        <DropdownMenuSeparator className="mx-2 my-1" />
        <DropdownMenuItem onSelect={model.goManageModels} className="gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground focus:bg-muted/60">
          <Settings2 className="size-4" />Kelola model
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
