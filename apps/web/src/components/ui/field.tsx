import * as React from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Gaya input modern yang seragam: tanpa ring/border tambahan saat difokuskan. */
export const FIELD_INPUT_CLASS =
  "h-11 rounded-xl border-border/60 bg-muted/40 px-4 text-sm shadow-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-border/60 focus-visible:ring-0"

function Field({
  className,
  label,
  hint,
  htmlFor,
  children,
  ...props
}: React.ComponentProps<"div"> & { label: React.ReactNode; hint?: React.ReactNode; htmlFor?: string }) {
  return (
    <div data-slot="field" className={cn("space-y-2", className)} {...props}>
      <label htmlFor={htmlFor} className="block text-sm font-medium leading-none">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span> : null}
      </label>
      {children}
    </div>
  )
}

function TextField({
  label,
  hint,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "className"> & { label: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <Field label={label} hint={hint} htmlFor={props.id} className={className}>
      <Input className={FIELD_INPUT_CLASS} {...props} />
    </Field>
  )
}

function SelectField({
  label,
  hint,
  className,
  id,
  placeholder,
  disabled,
  value,
  defaultValue,
  onValueChange,
  options,
}: {
  id?: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <Select value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export { Field, TextField, SelectField }