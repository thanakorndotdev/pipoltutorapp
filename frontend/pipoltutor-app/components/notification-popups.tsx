"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "./ui";

type Notice = { id: string; kind: string; title: string; body: string | null; link: string | null };

/**
 * In-site notifications for the signed-in user. Each one is shown until it
 * is closed, and closing it is recorded on the server, so it never pops up
 * again on a later visit or another device.
 */
export function NotificationPopups() {
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d: { notifications: Notice[] }) => !cancelled && setItems(d.notifications))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss(id: string) {
    try{const r=await fetch(`/api/notifications/${id}/dismiss`, { method: "POST",keepalive:true });if(r.ok)setItems(list=>list.filter(n=>n.id!==id));}catch{}
  }

  if (items.length === 0) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2.5 sm:inset-x-auto sm:right-6 sm:w-[380px]" role="region" aria-label="การแจ้งเตือน">
      {items.slice(0, 3).map((n) => (
        <div key={n.id} role="status" className="flex items-start gap-3 rounded-[20px] border border-border bg-card p-4 shadow-l">
          <Icon name="notifications" size={22} fill className="mt-0.5 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15.5px] font-medium leading-[1.4]">{n.title}</p>
            {n.body ? <p className="text-[14px] text-ink2">{n.body}</p> : null}
            {n.link ? (
              <Link href={n.link} onClick={() => dismiss(n.id)} className="mt-1 inline-flex min-h-[44px] items-center font-display text-[14.5px] font-medium text-brand">
                เปิดดู
              </Link>
            ) : null}
          </div>
          <button type="button" aria-label="ปิดการแจ้งเตือน" onClick={() => dismiss(n.id)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink3 hover:bg-page">
            <Icon name="close" size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}
