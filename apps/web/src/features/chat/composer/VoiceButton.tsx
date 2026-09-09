import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

function MicIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={props.className ?? "size-4"}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

type Rec = {
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  lang: string;
  interimResults: boolean;
};

function createRecognizer(): Rec | null {
  const w = window as unknown as Record<string, (new () => Rec) | undefined>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "id-ID";
  rec.interimResults = false;
  return rec;
}

export function VoiceButton(props: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [supported] = useState(() => createRecognizer() !== null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Rec | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = createRecognizer();
    if (!rec) return;
    recRef.current = rec;
    rec.onresult = (e) => {
      const parts: string[] = [];
      for (const group of Array.from(e.results as unknown as Iterable<ArrayLike<{ transcript: string }>>)) {
        const first = (group as ArrayLike<{ transcript: string }>)[0];
        if (first?.transcript) parts.push(first.transcript);
      }
      const text = parts.join(" ").trim();
      if (text) props.onTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`size-9 rounded-xl transition-all ${listening ? "bg-red-500/15 text-red-500" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
      onClick={toggle}
      disabled={props.disabled}
      aria-label={listening ? "Berhenti merekam suara" : "Input suara"}
      title={listening ? "Berhenti merekam suara" : "Input suara (Bahasa Indonesia)"}
    >
      <MicIcon className={`size-4 ${listening ? "animate-pulse" : ""}`} />
    </Button>
  );
}
