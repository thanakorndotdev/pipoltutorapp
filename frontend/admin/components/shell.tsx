"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { useAdmin } from "@/lib/admin";
import { Button, Card, Icon, Note, inputClass } from "@/components/ui";

const NAV = [
  { href: "/", label: "ภาพรวม", icon: "dashboard" },
  { href: "/questions/", label: "คลังข้อสอบ", icon: "quiz" },
  { href: "/packs/", label: "ชุดข้อสอบ", icon: "inventory_2" },
  { href: "/settings/", label: "วันสอบและเวลา", icon: "event" },
  { href: "/images/", label: "รูปภาพเว็บไซต์", icon: "image" },
  { href: "/texts/", label: "ข้อความเว็บไซต์", icon: "edit_note" },
  { href: "/users/", label: "ผู้ใช้และสิทธิ์", icon: "manage_accounts" },
];

/** Same-origin backend route; a plain <a> so basePath (/admin) is not prepended. */
const GOOGLE_LOGIN = "/api/auth/google?next=/admin/";

/** Sidebar on desktop, top bar with a scrollable nav row on phone. */
export function Shell({ children }: { children: ReactNode }) {
  const { auth, ready, signOut } = useAdmin();
  const pathname = usePathname();

  if (!ready) return <div className="min-h-screen bg-page" aria-busy />;
  if (!auth) return <Gate />;

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col bg-page md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-border bg-card md:sticky md:top-0 md:h-screen md:w-[240px] md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="grid size-9 place-items-center rounded-[10px] bg-brand-grad text-[13px] font-semibold text-white">จภ</span>
          <div className="leading-tight">
            <p className="display text-[15px] font-semibold">PIPOL TUTOR</p>
            <p className="text-[12.5px] text-ink3">แผงผู้ดูแลระบบ</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0" aria-label="เมนูหลัก">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 text-[15px] font-medium ${
                active(n.href) ? "bg-brand-50 text-brand" : "text-ink2 hover:bg-page"
              }`}
            >
              <Icon name={n.icon} fill={active(n.href)} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-border p-3 md:block">
          {auth.via === "session" ? (
            <div className="mb-2 flex items-center gap-2.5 px-2">
              {auth.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Google avatar
                <img src={auth.user.avatarUrl} alt="" className="size-8 shrink-0 rounded-full" />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand"><Icon name="person" size={18} /></span>
              )}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13.5px] font-medium">{auth.user.displayName ?? auth.user.email}</p>
                <p className="truncate text-[12px] text-ink3">{auth.user.email}</p>
              </div>
            </div>
          ) : (
            <p className="mb-2 px-2 text-[12.5px] text-ink3">เข้าด้วย API key</p>
          )}
          <Button kind="subtle" icon="logout" className="w-full justify-start" onClick={() => void signOut()}>
            ออกจากระบบ
          </Button>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

function Gate() {
  const { signIn, sessionError } = useAdmin();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ok = await signIn(value);
      if (!ok) setError("API key ไม่ถูกต้อง");
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-page px-4 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-[440px]">
      <Card className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[12px] bg-brand-grad text-[15px] font-semibold text-white">จภ</span>
          <div>
            <h1 className="text-[20px] font-semibold">แผงผู้ดูแลระบบ</h1>
            <p className="text-[14px] text-ink3">PIPOL TUTOR</p>
          </div>
        </div>
        <a
          href={GOOGLE_LOGIN}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] border border-border bg-card px-4 text-[15px] font-medium text-ink hover:bg-page"
        >
          <Icon name="account_circle" size={19} />
          เข้าสู่ระบบด้วย Google
        </a>
        {sessionError ? <Note tone="warn">{sessionError} — ให้ผู้ดูแลเปลี่ยนสิทธิ์ในเมนู “ผู้ใช้และสิทธิ์” ก่อน</Note> : null}
        <p className="text-center text-[13px] text-ink3">เฉพาะบัญชีที่มีสิทธิ์ admin / dev เท่านั้น — หรือใช้ API key ด้านล่าง</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-key" className="display text-[14px] font-medium">
            API key
          </label>
          <input
            id="admin-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="วาง ADMIN_API_KEY"
            aria-invalid={error ? true : undefined}
            className={`${inputClass} ${error ? "border-red" : ""}`}
          />
          <p className="text-[13.5px] text-ink3">ค่าจาก docker/.env — เก็บไว้เฉพาะแท็บนี้ ปิดแท็บแล้วหาย</p>
        </div>
        {error ? <Note tone="error">{error}</Note> : null}
        <Button type="submit" icon="key" disabled={busy || !value.trim()}>
          {busy ? "กำลังตรวจ…" : "เข้าสู่ระบบ"}
        </Button>
      </Card>
      </form>
    </div>
  );
}
