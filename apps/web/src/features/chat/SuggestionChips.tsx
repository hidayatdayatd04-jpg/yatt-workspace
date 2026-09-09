export function SuggestionChips(props: { suggestions: string[]; onSelect?: (prompt: string) => void; disabled?: boolean }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {props.suggestions.map((s) => (
        <button
          key={s}
          type="button"
          disabled={props.disabled}
          onClick={() => props.onSelect?.(s)}
          title={`Kirim: ${s}`}
          className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-300"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
