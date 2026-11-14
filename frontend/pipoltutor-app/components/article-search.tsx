"use client";
import { useEffect, useState } from "react";
export function ArticleSearch({
  initial = "",
  popular = [],
}: {
  initial?: string;
  popular?: string[];
}) {
  const [q, setQ] = useState(initial),
    [suggestions, setSuggestions] = useState<string[]>(popular);
  useEffect(() => {
    if (!q.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/articles?q=${encodeURIComponent(q)}&limit=8`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d) => setSuggestions(d.suggestions ?? []))
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);
  return (
    <label className="flex flex-1 flex-col gap-2 text-[16px]">
      ค้นหาบทเรียนหรือข่าว
      <input
        name="q"
        list="article-suggestions"
        className="min-h-[48px] rounded-[12px] border border-border bg-card px-4"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ชื่อเรื่อง หัวข้อ หรือแท็ก"
      />
      <datalist id="article-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </label>
  );
}
