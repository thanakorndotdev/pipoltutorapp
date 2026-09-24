"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Icon } from "@/components/ui";
import { formatClock } from "@/lib/format";
import { KEYS, SUBJECTS, TOTAL, initialState, questionFor, subjectOf, type Key } from "./exam-mock";

const MILESTONES = [25, 50, 75, 100];

type Props = {
  /** Time the student gets: pack duration × the multiplier in exam_settings. */
  allowedSeconds: number;
};

export function ExamClient({ allowedSeconds }: Props) {
  const [state, setState] = useState(initialState);
  const [coach, setCoach] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(allowedSeconds);

  const { answers, flags, current } = state;
  const subject = subjectOf(current);
  const q = questionFor(current);
  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);
  const remaining = TOTAL - answeredCount;
  const nextMilestone = MILESTONES.find((m) => m > answeredCount) ?? 100;

  // Decorative only — the server clock (attempts.expiresAt) is the authority.
  useEffect(() => {
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const go = useCallback((n: number) => {
    setState((s) => ({ ...s, current: Math.min(TOTAL, Math.max(1, n)) }));
  }, []);
  const pick = useCallback(
    (k: Key | undefined) => setState((s) => ({ ...s, answers: { ...s.answers, [s.current]: k } })),
    []
  );
  const toggleFlag = useCallback(() => {
    setState((s) => {
      const flags = new Set(s.flags);
      if (flags.has(s.current)) flags.delete(s.current);
      else flags.add(s.current);
      return { ...s, flags };
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const i = (KEYS as readonly string[]).indexOf(e.key);
      if (i > -1) pick(KEYS[i]);
      else if (e.key === "ArrowLeft") go(current - 1);
      else if (e.key === "ArrowRight") go(current + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, go, pick]);

  const timer = formatClock(secondsLeft);
  const flagged = flags.has(current);
  const ringLen = 2 * Math.PI * 70;

  return (
    <div className="flex flex-1 flex-col">
      {/* exam bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card px-5 py-3.5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex size-[46px] items-center justify-center rounded-full bg-gradient-to-br from-mystic to-brand font-display text-[19px] font-semibold text-on-fill">น</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-[16px] font-semibold">นักเรียน</span>
            </div>
            <p className="text-[12.5px] text-ink3">ชุดข้อสอบเสมือนจริง ชุดที่ 1 · {TOTAL} ข้อ</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-4 py-2 text-[13.5px] text-green" aria-live="polite">
            <Icon name="cloud_done" size={17} />เซฟให้แล้ว
          </span>
          <span className="tabular inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-4 py-2 font-display text-[17px] font-medium text-accent-dark">
            <Icon name="timer" size={19} />{timer}
          </span>
          <button type="button" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-[1.5px] border-border-strong bg-card px-4 py-2 font-display text-[14.5px] font-medium text-ink2">
            <Icon name="pause_circle" size={17} />พักไว้ก่อน
          </button>
        </div>
      </div>

      {/* subject tabs */}
      <div className="border-b border-border bg-card px-5 pb-3.5 md:px-10">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="วิชา">
          {SUBJECTS.map((s) => {
            const on = s.id === subject.id;
            const done = Array.from({ length: s.total }, (_, i) => s.from + i).filter((n) => answers[n]).length;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => go(s.from)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border-[1.5px] px-[18px] py-2 font-display text-[14.5px] font-medium ${
                  on ? "border-brand bg-brand-50 text-brand-dark" : "border-border bg-page text-ink2"
                }`}
              >
                <Icon name={s.icon} size={18} className={on ? "text-brand" : "text-ink3"} />
                {s.label}
                <span className={`tabular font-sans text-[13px] font-normal ${on ? "text-brand" : "text-ink3"}`}>{done}/{s.total}</span>
              </button>
            );
          })}
          <span className="ml-auto hidden whitespace-nowrap text-[13px] text-ink3 xl:block">ข้ามไปวิชาไหนก่อนก็ได้ คำตอบเก็บแยกตามวิชา</span>
        </div>
      </div>

      <div className="flex flex-col gap-7 px-5 pb-14 pt-6 md:px-10 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          {/* quest track */}
          <section className="flex flex-col gap-3.5 rounded-[26px] border border-border bg-card p-6 shadow-s">
            <div className="flex items-center gap-3">
              <Icon name="flag_circle" size={24} fill className="text-mystic" />
              <h2 className="text-[18px] font-semibold">ด่านวันนี้</h2>
              <span className="ml-auto whitespace-nowrap font-display text-[15px] font-medium text-mystic">
                {answeredCount >= 100 ? "ครบทุกข้อแล้ว" : `อีก ${nextMilestone - answeredCount} ข้อถึงด่าน ${nextMilestone} ข้อ`}
              </span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-page" aria-hidden>
              <div className="h-full rounded-full bg-mystic" style={{ width: `${answeredCount}%` }} />
            </div>
            <ol className="flex justify-between">
              {MILESTONES.map((m) => {
                const done = answeredCount >= m;
                const next = !done && m === nextMilestone;
                return (
                  <li key={m} className="flex flex-col items-center gap-[7px] text-center">
                    <span
                      className={`flex size-11 items-center justify-center rounded-full ${
                        done ? "bg-green-50 text-green" : next ? "border-2 border-mystic bg-mystic-50 text-mystic" : "border-[1.5px] border-border bg-page text-ink3"
                      }`}
                    >
                      <Icon name={done ? "check_circle" : next ? "bolt" : "emoji_events"} size={23} fill={done || next} />
                    </span>
                    <span className={`font-display text-[13px] font-medium ${done || next ? "text-ink2" : "text-ink3"}`}>
                      {m === 100 ? "จบชุด" : done ? `ครบ ${m} ข้อ` : next ? `อีก ${m - answeredCount} ข้อ` : `ด่าน ${m} ข้อ`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {coach ? (
            <div className="flex items-start gap-3 rounded-[20px] bg-amber-50 px-[18px] py-4">
              <Icon name="sentiment_very_satisfied" size={22} fill className="mt-0.5 text-amber-icon" />
              <div className="flex-1">
                <p className="font-display text-[15.5px] font-medium text-amber-ink">อีก {Math.floor(secondsLeft / 60)} นาที กำลังดีเลย</p>
                <p className="text-[15px] text-amber-ink">เหลืออีก {remaining} ข้อ ข้อไหนยากข้ามไปก่อนได้ เดี๋ยวค่อยวนกลับมาเก็บ</p>
              </div>
              <button type="button" aria-label="ปิดข้อความ" onClick={() => setCoach(false)} className="text-ink3">
                <Icon name="close" size={20} />
              </button>
            </div>
          ) : null}

          {/* question */}
          <section className="rounded-[28px] border border-border bg-card p-5 shadow-m md:p-[34px]" aria-labelledby="q-title">
            <div className="flex flex-wrap items-center gap-3.5">
              <h3 id="q-title" className="whitespace-nowrap text-[22px] font-semibold">ข้อ {current}</h3>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 font-display text-[13.5px] font-medium text-brand-dark">
                <Icon name={subject.icon} size={17} />{subject.label} · {q.topic}
              </span>
              <button
                type="button"
                aria-pressed={flagged}
                onClick={toggleFlag}
                className={`ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] px-[18px] py-2 font-display text-[14.5px] font-medium ${
                  flagged ? "border-red bg-red-50 text-red" : "border-border-strong bg-card text-ink2"
                }`}
              >
                <Icon name="flag" size={19} fill={flagged} />
                {flagged ? "ปักธงไว้แล้ว" : "ปักธงไว้ทบทวน"}
              </button>
            </div>

            <p className="my-[18px] text-[18px] leading-[1.85] md:text-[20px]">{q.stem}</p>

            {q.figure ? (
              <div className="flex flex-col items-center gap-1.5 rounded-[18px] border border-border-strong bg-page p-[22px] text-center">
                <Icon name="image" size={26} className="text-ink3" />
                <span className="text-[13.5px] text-ink3">พื้นที่สำหรับรูปประกอบโจทย์ (ถ้ามี) — รองรับรูปภาพและตาราง</span>
              </div>
            ) : null}

            <div className="mt-[18px] flex flex-col gap-3" role="radiogroup" aria-label="ตัวเลือกคำตอบ">
              {q.choices.map((c, i) => {
                const k = KEYS[i];
                const on = answers[current] === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pick(k)}
                    className={`flex w-full items-center gap-4 rounded-[20px] border bg-card px-5 py-4 text-left transition-colors ${
                      on ? "border-2 border-brand bg-brand-50" : "border-[1.5px] border-border hover:border-border-strong"
                    }`}
                  >
                    <span
                      className={`flex size-[42px] shrink-0 items-center justify-center rounded-[14px] border font-display text-[17px] font-medium ${
                        on ? "border-brand bg-brand text-on-fill" : "border-border bg-page text-ink2"
                      }`}
                    >
                      {k}
                    </span>
                    <span className="tabular flex-1 text-[17.5px]">{c}</span>
                    <Icon name="check_circle" size={24} fill className={`text-brand ${on ? "opacity-100" : "opacity-0"}`} />
                  </button>
                );
              })}
            </div>

            <div className="mt-[22px] flex flex-wrap items-center justify-between gap-3.5">
              <Button kind="ghost" icon="arrow_back" onClick={() => go(current - 1)} disabled={current === 1}>ข้อก่อนหน้า</Button>
              <button type="button" onClick={() => pick(undefined)} className="inline-flex items-center gap-2 font-display text-[14.5px] font-medium text-ink3">
                <Icon name="backspace" size={18} />ล้างคำตอบข้อนี้
              </button>
              <Button kind="brand" icon="arrow_forward" trailingIcon onClick={() => go(current + 1)} disabled={current === TOTAL}>ข้อถัดไป</Button>
            </div>
            <p className="mt-3 text-center text-[13px] text-ink3">เคล็ดลับ: กดปุ่ม ก ข ค ง บนคีย์บอร์ดเลือกคำตอบได้ กดลูกศรซ้ายขวาเปลี่ยนข้อ</p>
          </section>

          <div className="flex items-start gap-3 rounded-[20px] bg-brand-50 px-[18px] py-[15px]">
            <Icon name="lock" size={21} fill className="mt-0.5 text-brand" />
            <div>
              <p className="font-display text-[15.5px] font-medium">เฉลยไม่ถูกส่งมาที่เครื่องของน้อง</p>
              <p className="text-[15px] text-ink2">ระบบตรวจคำตอบบนเซิร์ฟเวอร์ทั้งหมด เปิด F12 หรือดูซอร์สโค้ดก็ไม่พบเฉลย</p>
            </div>
          </div>
        </div>

        {/* rail */}
        <aside className="flex w-full flex-col gap-[18px] rounded-[28px] border border-border bg-card p-[22px] shadow-s lg:w-[330px] lg:shrink-0">
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative size-[156px]">
              <svg width="156" height="156" viewBox="0 0 156 156" aria-hidden className="-rotate-90">
                <circle cx="78" cy="78" r="70" fill="none" className="stroke-page" strokeWidth="16" />
                <circle
                  cx="78"
                  cy="78"
                  r="70"
                  fill="none"
                  className="stroke-brand"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={ringLen}
                  strokeDashoffset={ringLen * (1 - answeredCount / TOTAL)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="tabular font-display text-[41px] font-semibold leading-[1.18]">{answeredCount}</span>
                <span className="text-[15px] text-ink3">จาก {TOTAL} ข้อ</span>
              </div>
            </div>
            <p className="text-center text-[13.5px] text-ink3">ตอบแล้ว {answeredCount} ข้อ · ปักธงไว้ {flags.size} ข้อ</p>
          </div>

          <div className="flex flex-wrap gap-[5px]" aria-label="ตารางข้อสอบ">
            {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => {
              const cls =
                n === current
                  ? "border-brand bg-brand text-on-fill"
                  : flags.has(n)
                    ? "border-red bg-red text-on-fill"
                    : answers[n]
                      ? "border-green bg-green text-on-fill"
                      : "border-border bg-page text-ink3";
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`ข้อ ${n}`}
                  aria-current={n === current ? "true" : undefined}
                  onClick={() => go(n)}
                  className={`tabular flex size-[26px] items-center justify-center rounded-[8px] border font-display text-[10px] ${cls}`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <ul className="flex flex-col gap-2 text-[13.5px] text-ink2">
            <li className="flex items-center gap-2"><i className="size-4 rounded-[5px] border border-border bg-page" />ยังไม่ได้ทำ</li>
            <li className="flex items-center gap-2"><i className="size-4 rounded-[5px] bg-green" />ตอบแล้ว</li>
            <li className="flex items-center gap-2"><i className="size-4 rounded-[5px] bg-red" />ปักธงไว้ทบทวน</li>
            <li className="flex items-center gap-2"><i className="size-4 rounded-[5px] bg-brand" />ข้อที่กำลังทำอยู่</li>
          </ul>

          <div className="flex flex-col gap-2 rounded-[18px] bg-page px-4 py-3.5 text-[13.5px] text-ink2">
            <p className="font-display text-[14.5px] font-medium text-ink">ก่อนส่ง เช็กให้ครบ</p>
            <p className="flex items-start gap-2"><Icon name="radio_button_unchecked" size={17} />ยังไม่ได้ตอบ {remaining} ข้อ</p>
            <p className="flex items-start gap-2"><Icon name="flag" size={17} fill className="text-red" />ปักธงรอทบทวน {flags.size} ข้อ</p>
            <p className="flex items-start gap-2"><Icon name="timer" size={17} className="text-accent-dark" />เหลือเวลา {timer} หมดเวลาระบบส่งให้เอง</p>
          </div>

          <Button href="/exam/result" icon="task_alt" className="w-full">ส่งคำตอบและตรวจ</Button>
          <p className="text-center text-[12.5px] text-ink3">ส่งได้เมื่อทำครบทุกข้อ หรือเมื่อหมดเวลา</p>
        </aside>
      </div>
    </div>
  );
}
