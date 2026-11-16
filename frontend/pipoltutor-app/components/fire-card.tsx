"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./ui";
export type Fire = {
  current: number;
  highest: number;
  pendingDate: string | null;
  pendingDeadline: string | null;
  remaining: number;
  cap: number;
  used: number;
  todayState: string;
};
/** Today's set as GET /daily/today reports it for the signed-in student. */
type Today = { questions: { tries: number; correct: boolean }[] };
/** One sentence on where today's set stands; two tries per question (FIRE-02). */
function todaySummary(today: Today) {
  const total = today.questions.length;
  if (total === 0) return "วันนี้ไม่มีโจทย์ ระบบรักษาไฟให้อัตโนมัติ";
  const right = today.questions.filter((q) => q.correct).length;
  const open = today.questions.filter((q) => !q.correct && q.tries < 2).length;
  if (right === total) return `โจทย์วันนี้ ตอบถูกครบ ${total} ข้อแล้ว`;
  if (open === 0) return `โจทย์วันนี้ ตอบถูก ${right}/${total} ข้อ ใช้โอกาสครบแล้ว`;
  return `โจทย์วันนี้ ตอบถูก ${right}/${total} ข้อ ยังตอบได้อีก ${open} ข้อ`;
}
export function FireCard() {
  const [fire, setFire] = useState<Fire | null>(null),
    [today, setToday] = useState<Today | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/daily/fire", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setFire)
      .catch(() => {});
    fetch("/api/daily/today", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setToday)
      .catch(() => {});
  }, []);
  async function recover() {
    setBusy(true);
    try {
      const r = await fetch("/api/daily/recover", { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "กู้ไฟไม่สำเร็จ");
      setFire(body as Fire);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  if (!fire) return null;
  const states: Record<string, string> = {
    increased: "วันนี้เพิ่มไฟแล้ว",
    protected: "วันนี้รักษาไฟแล้ว",
    protected_by_exam: "รักษาไฟด้วยข้อสอบแล้ว",
    auto_protected: "วันนี้ระบบรักษาไฟให้",
    admin_protected: "ผู้ดูแลรักษาไฟให้",
    recovered: "กู้ไฟของวันนี้แล้ว",
    pending: "รอกู้ไฟ",
    lost: "ไฟเริ่มนับใหม่",
    incomplete: "ยังทำโจทย์วันนี้ไม่ครบ",
  };
  const state = states[fire.todayState] ?? states.incomplete;
  // A day without a set is settled as auto_protected only after it ends, so until
  // then the ledger still says incomplete; let the set's own summary speak alone.
  const status = !today
    ? state
    : today.questions.length === 0 && fire.todayState === "incomplete"
      ? todaySummary(today)
      : `${state} · ${todaySummary(today)}`;
  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-[21px] font-semibold">
        <Icon name="local_fire_department" className="text-accent" />
        ไฟของน้อง
      </h2>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <p className="flex items-center gap-1 text-accent">
          <Icon name="local_fire_department" size={32} fill />
          <span className="sr-only">ไฟปัจจุบัน</span>
          <b className="font-display text-[30px] leading-[1.3]">{fire.current}</b>
        </p>
        <p>สูงสุด {fire.highest}</p>
        <p>
          สิทธิ์กู้คงเหลือ {fire.remaining}/{fire.cap}
        </p>
      </div>
      <p className="text-[16px] text-ink2">{status}</p>
      {fire.pendingDate ? (
        <div className="rounded-[12px] bg-amber-50 p-4 text-amber-ink">
          {/* The window always closes at the end of today, Bangkok time (FIRE-08). */}
          <p>คุณมีไฟที่รอกู้คืนภายในวันนี้ 23:59 น. หากไม่กู้จะเริ่มนับไฟใหม่</p>
          <p>
            วันที่ขาด{" "}
            {new Intl.DateTimeFormat("th-TH", {
              calendar: "buddhist",
              timeZone: "Asia/Bangkok",
              dateStyle: "long",
            }).format(new Date(`${fire.pendingDate}T00:00:00+07:00`))}
          </p>
          <button
            type="button"
            disabled={busy || fire.remaining === 0}
            className="mt-3 min-h-[44px] rounded-full bg-brand px-5 text-on-fill disabled:opacity-50"
            onClick={() => void recover()}
          >
            {busy ? "กำลังกู้ไฟ…" : "ใช้สิทธิ์กู้ไฟ"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-red">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-6">
        <Link
          href="/daily"
          className="inline-flex min-h-[44px] items-center font-medium text-brand"
        >
          ทำโจทย์วันนี้ →
        </Link>
        <Link
          href="/daily#archive"
          className="inline-flex min-h-[44px] items-center font-medium text-brand"
        >
          ดูโจทย์ย้อนหลัง
        </Link>
      </div>
    </section>
  );
}
export function HeaderFire() {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/daily/fire", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setValue(d?.current ?? null))
      .catch(() => {});
  }, []);
  return value === null ? null : (
    <span
      className="inline-flex items-center gap-1 text-[14px] text-accent"
      aria-label={`ไฟปัจจุบัน ${value}`}
    >
      <Icon name="local_fire_department" size={18} />
      {value}
    </span>
  );
}
