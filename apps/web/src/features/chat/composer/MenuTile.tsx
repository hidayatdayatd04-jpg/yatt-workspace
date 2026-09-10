export function MenuTile({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${className ?? "bg-muted text-muted-foreground"}`}>
      {children}
    </span>
  );
}
