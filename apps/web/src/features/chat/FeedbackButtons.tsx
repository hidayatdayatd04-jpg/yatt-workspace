import { useState } from "react";

function ThumbIcon(props: { down?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className ?? "size-3.5"}
      style={props.down ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

export function FeedbackButtons(props: { messageId: string; conversationId?: string | null; disabled?: boolean }) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(next: 1 | -1) {
    if (!props.conversationId || busy || props.disabled) return;
    const target = rating === next ? null : next;
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${props.conversationId}/messages/${props.messageId}/feedback`, {
        method: target === null ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(target === null ? {} : { body: JSON.stringify({ rating: target }) }),
      });
      if (!res.ok) throw new Error();
      setRating(target);
    } catch {
      /* non-fatal */
    } finally {
      setBusy(false);
    }
  }

  const btn = (value: 1 | -1, label: string, down?: boolean) => (
    <button
      type="button"
      disabled={busy || props.disabled}
      onClick={() => void send(value)}
      aria-label={label}
      aria-pressed={rating === value}
      title={label}
      className={`rounded-md p-1.5 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 ${
        rating === value ? "text-indigo-500" : "text-muted-foreground"
      }`}
    >
      <ThumbIcon down={down} />
    </button>
  );

  return (
    <span className="flex items-center">
      {btn(1, "Jawaban membantu")}
      {btn(-1, "Jawaban kurang membantu", true)}
    </span>
  );
}
