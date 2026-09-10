import { Switch } from "@/components/ui/switch";

export function ServicePermission(props: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-5 py-4"><span><span className="block text-sm font-medium">{props.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{props.description}</span></span><Switch aria-label={props.label} checked={props.checked} disabled={props.disabled} onCheckedChange={props.onChange} /></label>;
}
