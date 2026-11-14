"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Comment = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: string;
  name: string | null;
};
export function ArticleDiscussion({
  slug,
  loggedIn,
}: {
  slug: string;
  loggedIn: boolean;
}) {
  const [items, setItems] = useState<Comment[]>([]),
    [text, setText] = useState(""),
    [parent, setParent] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const path = `/api/articles/${encodeURIComponent(slug)}`;
  useEffect(() => {
    fetch(`${path}/comments`)
      .then((r) => r.json())
      .then((d) => setItems(d.comments ?? []))
      .catch(() => {});
    void fetch(`${path}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "view", referrer: document.referrer }),
    }).catch(() => {});
    if (document.referrer)
      void fetch(`${path}/event`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "click_in", referrer: document.referrer }),
        keepalive: true,
      }).catch(() => {});
    const click = (e: MouseEvent) => {
      const anchor = (e.target as Element)?.closest?.("a");
      if (anchor && anchor.hostname !== window.location.hostname)
        void fetch(`${path}/event`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "click_out" }),
          keepalive: true,
        }).catch(() => {});
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [path]);
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`${path}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, ...(parent ? { parentId: parent } : {}) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "ส่งความคิดเห็นไม่สำเร็จ");
      setMessage(d.message);
      setText("");
      setParent(null);
      const fresh = await fetch(`${path}/comments`);
      setItems((await fresh.json()).comments ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  function thread(c: Comment, depth = 0) {
    return (
      <li
        key={c.id}
        id={`comment-${c.id}`}
        className="scroll-mt-8 border-t border-border py-4"
      >
        <p className="text-[14px] font-medium">
          {c.name ?? "ผู้ใช้"} ·{" "}
          {new Date(c.createdAt).toLocaleDateString("th-TH")}
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words text-[16px]">
          {c.text}
        </p>
        {loggedIn ? (
          <button
            type="button"
            className="min-h-[44px] text-brand"
            onClick={() => setParent(c.id)}
          >
            ตอบกลับ
          </button>
        ) : null}
        {depth < 6 ? (
          <ul className="ml-3 border-l border-border pl-4">
            {items
              .filter((x) => x.parentId === c.id)
              .map((x) => thread(x, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  }
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="text-[23px] font-semibold">ความคิดเห็น</h2>
      <ul>
        {items
          .filter((c) => !c.parentId || !items.some((p) => p.id === c.parentId))
          .map((c) => thread(c))}
      </ul>
      {loggedIn ? (
        <>
          <label className="flex flex-col gap-2 text-[16px]">
            {parent ? "เขียนข้อความตอบกลับ" : "เขียนความคิดเห็น"}
            <textarea
              maxLength={3000}
              rows={4}
              className="rounded-[12px] border border-border bg-card p-4"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {parent ? (
            <button
              className="min-h-[44px] self-start text-brand"
              onClick={() => setParent(null)}
            >
              ยกเลิกการตอบกลับ
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !text.trim()}
            className="min-h-[48px] self-start rounded-full bg-brand px-6 text-on-fill disabled:opacity-50"
            onClick={() => void submit()}
          >
            {busy ? "กำลังส่ง…" : "ส่งความคิดเห็น"}
          </button>
        </>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(`/articles/${slug}`)}`}
          className="inline-flex min-h-[44px] items-center text-brand"
        >
          เข้าสู่ระบบด้วย Google เพื่อแสดงความคิดเห็น
        </Link>
      )}
      {message ? (
        <p role="status" className="text-[16px]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
