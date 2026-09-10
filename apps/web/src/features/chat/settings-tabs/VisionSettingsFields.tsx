import { SelectField, TextField } from "@/components/ui/field";
import type { ProviderForm } from "../provider-dialog/use-provider-form";

export const KIND_OPTIONS = [
  { value: "gemini", label: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/v1" },
  { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "custom", label: "Custom (OpenAI-compatible)", defaultUrl: "http://localhost:11434/v1" },
];
export function VisionSettingsFields({ form, onKindChange }: { form: ProviderForm; onKindChange: (kind: string) => void }) {
  return <div className="space-y-4">
    <SelectField id="vision-kind" label="Jenis provider" value={form.kind} options={KIND_OPTIONS} onValueChange={onKindChange} />
    <TextField id="vision-name" label="Nama provider" maxLength={128} value={form.name} onChange={(e) => form.setName(e.target.value)} />
    <TextField id="vision-url" label="Base URL" maxLength={512} value={form.baseUrl} onChange={(e) => form.setBaseUrl(e.target.value)} />
    <TextField id="vision-key" label="API key" type="password" autoComplete="off" maxLength={512}
      hint={form.hasSavedKey ? "kosongkan untuk memakai kunci tersimpan" : "wajib untuk provider baru"}
      value={form.apiKey} onChange={(e) => form.setApiKey(e.target.value)} />
  </div>;
}
