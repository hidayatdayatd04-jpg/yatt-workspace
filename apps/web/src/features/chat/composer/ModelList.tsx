import { Check } from "@/components/icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ModelLimitIndicator } from "../ModelLimitIndicator";
import type { ComposerModel } from "./use-composer-model";
import { matchesModelQuery, modelDisplayName } from "./model-display";

/** Pilihan model memakai nama besar dan penyedia sebagai deskripsi yang terverifikasi. */
export function ModelList({ model }: { model: ComposerModel }) {
  const options = model.enabledProviders.flatMap((provider) => (provider.models ?? [])
    .filter((id) => matchesModelQuery(id, provider.name, model.modelQuery))
    .map((id) => ({ provider, id })));
  if (!options.length) return <p className="px-3 py-5 text-sm text-muted-foreground">Tidak ada model yang cocok.</p>;
  return options.map(({ provider, id }) => {
    const selected = model.effectiveSelection?.providerId === provider.id && model.effectiveModel === id;
    return (
      <DropdownMenuItem key={`${provider.id}/${id}`} onSelect={() => model.selectModel(provider.id, id)}
        title={id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 focus:bg-muted/60" aria-label={`${modelDisplayName(id)} — ${provider.name}`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium leading-6">{modelDisplayName(id)}</span>
          <span className="block truncate text-[13px] leading-5 text-muted-foreground">{provider.name}</span>
        </span>
        <ModelLimitIndicator data={provider.modelLimits?.[id]} compact />
        {selected && <Check className="size-4 shrink-0 text-foreground/70" />}
      </DropdownMenuItem>
    );
  });
}
