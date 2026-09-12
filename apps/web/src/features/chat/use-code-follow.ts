import { useEffect, useRef } from "react";

/** Ikuti kode baru; berhenti mengikuti ketika pengguna membaca bagian sebelumnya. */
export function useCodeFollow(code: string, live?: boolean) {
  const ref = useRef<HTMLPreElement>(null);
  const following = useRef(true);
  useEffect(() => {
    if (live && following.current && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [code, live]);
  const onScroll = () => {
    const el = ref.current;
    if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
  };
  return { ref, onScroll };
}
