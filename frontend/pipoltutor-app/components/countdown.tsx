"use client";

import { useSyncExternalStore } from "react";

import { useCopy } from "./site-assets";

export type CountdownProps = {
  /** ISO instant of the exam; the tiles count down to this. */
  examDate: string;
  /** Preformatted Buddhist-era labels, e.g. "25 มกราคม 2569". */
  examDateLabel: string;
  enrollCloseLabel: string;
  venueLabel: string;
  /** Tiles turn orange at this many days or fewer. Comes from exam_settings. */
  urgentDays: number;
  /** Backend clock at render time; used for the server-rendered snapshot. */
  serverNow: string;
};

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** 1 Hz clock once hydrated; SSR and the hydration pass use the server clock. */
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}
const getNow = () => Math.floor(Date.now() / 1000) * 1000;

/**
 * Countdown to the exam date held in exam_settings. The backend decides the
 * date, the venue, and the urgent threshold; this component only ticks.
 */
export function Countdown({
  examDate,
  examDateLabel,
  enrollCloseLabel,
  venueLabel,
  urgentDays,
  serverNow,
}: CountdownProps) {
  const { t } = useCopy();
  const serverMs = Math.floor(new Date(serverNow).getTime() / 1000) * 1000;
  const now = useSyncExternalStore(subscribe, getNow, () => serverMs);

  const left = new Date(examDate).getTime() - now;
  const p = parts(left);
  const passed = left <= 0;
  const urgent = !passed && p.days <= urgentDays;

  const tiles: [string, string][] = [
    [String(p.days), "วัน"],
    [String(p.hours).padStart(2, "0"), "ชั่วโมง"],
    [String(p.minutes).padStart(2, "0"), "นาที"],
    [String(p.seconds).padStart(2, "0"), "วินาที"],
  ];

  return (
    <div className="bg-brand-grad flex flex-col items-center gap-[26px] rounded-[28px] p-6 shadow-l md:p-11">
      <h2 className="text-center text-[26px] font-semibold text-white md:text-[32px]">{t("home.countdown_title", "นับถอยหลังสู่วันสอบคัดเลือก ม.1")}</h2>
      <p className="text-center text-[16px] text-on-grad-soft">
        สนามสอบ {venueLabel} · {examDateLabel} — ปิดรับสมัครคอร์ส {enrollCloseLabel}
      </p>
      {passed ? (
        <p className="rounded-full bg-white/12 px-5 py-2 text-[15px] text-white">ถึงวันสอบแล้ว — รอประกาศรอบถัดไป</p>
      ) : (
        <div className="grid w-full grid-cols-2 gap-3.5 sm:grid-cols-4 sm:justify-center" aria-live="off">
          {tiles.map(([v, label]) => (
            <div
              key={label}
              className={`flex flex-col items-center gap-[7px] rounded-[20px] border border-countdown-dark bg-countdown px-2.5 py-[18px] sm:w-[150px] sm:justify-self-center ${
                urgent ? "shadow-[0_0_0_4px_rgba(255,107,53,0.35)]" : ""
              }`}
            >
              <span className="tabular font-display text-[38px] font-semibold leading-[1.05] text-white">{v}</span>
              <span className="text-[13px] text-white/90">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
