import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "@/components/icons";
import type { User } from "@/components/icons";
import { Input } from "@/components/ui/input";

/** Gaya input seragam: tinggi, radius, dan tanpa ring/border tambahan saat difokuskan. */
const FIELD_CLASS =
  "h-11 rounded-xl border-border/60 bg-muted/40 px-4 text-sm shadow-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-border/60 focus-visible:ring-0";

type FieldProps = Omit<ComponentProps<typeof Input>, "className" | "id"> & {
  id: string;
  label: string;
  hint?: string;
};

/** Label + input bergaya modern; field password otomatis punya toggle lihat/sembunyi. */
export function ProfileField({ id, label, hint, type, ...input }: FieldProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span> : null}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && show ? "text" : type}
          className={`${FIELD_CLASS}${isPassword ? " pr-12" : ""}`}
          {...input}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Header kartu form profil: ikon bertema + judul + deskripsi singkat. */
export function ProfileCardHeader(props: { icon: typeof User; title: string; description: string }) {
  const Icon = props.icon;
  return (
    <header className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{props.title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{props.description}</p>
      </div>
    </header>
  );
}