"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { SessionUser } from "@/lib/auth";
import { NAV, TUTOR_NAME, type NavId } from "@/lib/content";
import { useCopy, useSessionUser, useSiteAsset } from "./site-assets";
import { Button, Icon } from "./ui";

export function BrandMark({ onDark = false }: { onDark?: boolean }) {
  const logo = useSiteAsset("logo");
  const { t } = useCopy();
  return (
    <Link href="/" className="flex items-center gap-[11px]" aria-label="PIPOL TUTOR หน้าแรก">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo
        <img src={logo.imageUrl} alt={logo.alt} className="size-[42px] shrink-0 rounded-[13px] object-contain" />
      ) : (
        <span
          className={`flex size-[42px] shrink-0 items-center justify-center rounded-[13px] font-display text-[15px] font-medium ${
            onDark ? "bg-white/16 text-white" : "bg-brand-grad text-white"
          }`}
        >
          จภ
        </span>
      )}
      <span className="flex flex-col">
        <span className={`font-display text-[16px] leading-[1.28] ${onDark ? "text-white" : "text-ink"}`}>
          PIPOL TUTOR
        </span>
        <span className={`text-[12.5px] leading-[1.4] ${onDark ? "text-on-grad-soft" : "text-ink3"}`}>
          {t("brand.tagline", "ติวเข้า ม.1 จภ.")}
        </span>
      </span>
    </Link>
  );
}

/** Signed-in destinations, in the order a student reaches for them. */
const USER_MENU = [
  { href: "/dashboard", icon: "grid_view", label: "เมนูหลัก", sub: "ความคืบหน้าและทางลัดทั้งหมด" },
  { href: "/exam", icon: "quiz", label: "คลังข้อสอบ", sub: "ชุดข้อสอบเสมือนจริง" },
  { href: "/courses/full-course", icon: "play_lesson", label: "คอร์สของฉัน", sub: "คลิปย้อนหลังและเอกสาร" },
  { href: "/exam/result", icon: "insights", label: "ผลคะแนน", sub: "สรุปรายบทและจุดอ่อน" },
] as const;

/**
 * `current` marks the active nav item. The signed-in chip appears whenever a
 * session exists; `app` is kept for call-site compatibility but no longer
 * fakes a user. On md+ the nav sits in the true centre of the bar (three
 * columns, brand and account flanking), on phones it folds into the burger.
 */
export function SiteHeader({ current }: { current: NavId; app?: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useCopy();
  const user = useSessionUser();
  const tutor = t("brand.tutor_name", TUTOR_NAME);
  const nav = NAV.map((item) => (item.id === "about" ? { ...item, label: `รู้จัก${tutor}` } : item));
  const currentLabel = nav.find((i) => i.id === current)?.label ?? "";

  return (
    <header className="w-full bg-card px-5 md:px-10 lg:px-[72px]">
      <div className="mx-auto flex w-full max-w-[1296px] items-center justify-between gap-5 py-3.5 md:grid md:grid-cols-[1fr_auto_1fr]">
        <BrandMark />

        <nav aria-label="เมนูหลัก" className="hidden items-center gap-4 md:flex lg:gap-6">
          {nav.map((item) => {
            const on = item.id === current;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1.5 whitespace-nowrap text-[13.5px] transition-colors lg:text-[15.5px] ${
                  on ? "font-display font-medium text-brand" : "text-ink2 hover:text-ink"
                }`}
              >
                {item.label}
                <span className={`h-0.5 w-full min-w-6 rounded-full ${on ? "bg-accent" : "bg-transparent"}`} />
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex md:justify-end">
          {user ? <UserMenu user={user} /> : <Button href="/login" icon="login" size="sm">เข้าสู่ระบบ</Button>}
        </div>

        {/* phone: current label + burger */}
        <div className="flex items-center gap-2.5 md:hidden">
          <span className="rounded-full bg-brand-50 px-3.5 py-[7px] font-display text-[14px] font-medium text-brand">
            {currentLabel}
          </span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            onClick={() => setOpen((v) => !v)}
            className="flex size-[42px] items-center justify-center rounded-[14px] border-[1.5px] border-border bg-page text-ink"
          >
            <Icon name={open ? "close" : "menu"} size={23} />
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="mx-auto w-full max-w-[1296px] border-t border-border pb-4 md:hidden">
        <nav aria-label="เมนูหลัก (มือถือ)" className="flex flex-col py-2">
          {nav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`min-h-[44px] py-2.5 text-[16px] ${
                item.id === current ? "font-display font-medium text-brand" : "text-ink2"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <MobileAccount user={user} onNavigate={() => setOpen(false)} />
        ) : (
          <Button href="/login" icon="login" className="w-full">เข้าสู่ระบบ</Button>
        )}
      </div>
    </header>
  );
}

function Avatar({ user, size }: { user: SessionUser; size: 34 | 44 }) {
  const cls = `shrink-0 rounded-full ${size === 44 ? "size-11" : "size-[34px]"}`;
  return user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Google profile photo
    <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className={`${cls} object-cover`} />
  ) : (
    <span className={`${cls} flex items-center justify-center bg-brand-100 text-brand`}>
      <Icon name="person" size={size === 44 ? 24 : 19} fill />
    </span>
  );
}

function useSignOut() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }
  return { busy, signOut };
}

/**
 * Desktop account control: avatar + name opens a popover with the signed-in
 * destinations and sign-out. Closes on outside click, Escape, or navigation.
 */
function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { busy, signOut } = useSignOut();
  const name = user.displayName?.trim() || user.email;
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[46px] items-center gap-2.5 rounded-full border py-1 pl-1 pr-2.5 transition-colors ${
          open ? "border-brand/40 bg-brand-50" : "border-border bg-page hover:border-border-strong"
        }`}
      >
        <Avatar user={user} size={34} />
        <span className="hidden max-w-[160px] truncate font-display text-[14px] font-medium leading-[1.3] lg:block">{name}</span>
        <Icon name="expand_more" size={20} className={`text-ink3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-label="บัญชีของฉัน"
        hidden={!open}
        className="absolute right-0 top-[calc(100%+10px)] z-40 w-[300px] origin-top-right overflow-hidden rounded-[22px] border border-border bg-card shadow-l motion-safe:animate-[menu-in_.18s_cubic-bezier(.16,1,.3,1)]"
      >
        <div className="flex items-center gap-3 px-4 pb-3.5 pt-4">
          <Avatar user={user} size={44} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-display text-[15px] font-medium leading-[1.3] text-ink">{name}</span>
            <span className="truncate text-[12.5px] leading-[1.5] text-ink3">{user.email}</span>
          </div>
        </div>
        <div className="mx-4 h-px bg-border" />
        <ul className="flex flex-col p-2">
          {USER_MENU.map((m) => (
            <li key={m.href}>
              <Link
                href={m.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex min-h-[48px] items-center gap-3 rounded-[14px] px-2.5 py-2 transition-colors hover:bg-brand-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-page text-brand transition-colors group-hover:bg-card">
                  <Icon name={m.icon} size={20} fill />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-[14.5px] font-medium leading-[1.3] text-ink">{m.label}</span>
                  <span className="truncate text-[12.5px] leading-[1.5] text-ink3">{m.sub}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mx-4 h-px bg-border" />
        <div className="p-2">
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={busy}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-page text-red">
              <Icon name="logout" size={20} />
            </span>
            <span className="font-display text-[14.5px] font-medium leading-[1.3] text-red">{busy ? "กำลังออก…" : "ออกจากระบบ"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Phone: the same destinations laid flat inside the burger panel. */
function MobileAccount({ user, onNavigate }: { user: SessionUser; onNavigate: () => void }) {
  const { busy, signOut } = useSignOut();
  const name = user.displayName?.trim() || user.email;
  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-border bg-page p-2.5">
      <div className="flex items-center gap-3 px-1.5 pb-1 pt-1.5">
        <Avatar user={user} size={44} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-display text-[15px] font-medium leading-[1.3] text-ink">{name}</span>
          <span className="truncate text-[12.5px] leading-[1.5] text-ink3">{user.email}</span>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {USER_MENU.map((m) => (
          <li key={m.href}>
            <Link
              href={m.href}
              onClick={onNavigate}
              className="flex min-h-[48px] items-center gap-2.5 rounded-[14px] bg-card px-3 py-2.5 shadow-s"
            >
              <Icon name={m.icon} size={20} fill className="text-brand" />
              <span className="font-display text-[14.5px] font-medium leading-[1.3] text-ink">{m.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] px-3 font-display text-[14.5px] font-medium text-red disabled:opacity-50"
      >
        <Icon name="logout" size={19} />
        {busy ? "กำลังออก…" : "ออกจากระบบ"}
      </button>
    </div>
  );
}
