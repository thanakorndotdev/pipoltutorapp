"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, Icon } from "@/components/ui";
import {
  ExamApiError,
  SUBJECT_META,
  loadAttempt,
  saveAnswer,
  startAttempt,
  submitAttempt,
  type ExamQuestion,
  type QuestionSubject,
} from "@/lib/exam";
import { formatClock } from "@/lib/format";

const MILESTONES = [25, 50, 75, 100];
const SUBJECT_ORDER: QuestionSubject[] = ["math", "science", "general_aptitude", "thai", "english"];
const RETRY_MS = 2000;

type Props = {
  packId: string;
  packTitle: string;
  studentName: string;
};

/** One question's state as the server stores it. */
type Entry = { selectedChoice: string | null; flagged: boolean };
type SaveState = "saved" | "saving" | "offline";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ExamClient({ packId, packTitle, studentName }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [index, setIndex] = useState(0);
  const [coach, setCoach] = useState(true);
  const [deadline, setDeadline] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  // Autosave queue: latest unsent state per question, drained one request
  // at a time so writes for a question never arrive out of order.
  const pending = useRef(new Map<string, Entry>());
  const flushing = useRef(false);
  const finishing = useRef(false);

  const finish = useCallback(
    async (id: string) => {
      if (finishing.current) return;
      finishing.current = true;
      setPhase("submitting");
      // Give queued saves a moment to land; the server grades what it holds.
      for (let i = 0; i < 20 && (pending.current.size > 0 || flushing.current); i++) await wait(500);
      for (;;) {
        try {
          await submitAttempt(id);
          break;
        } catch (error) {
          if (error instanceof ExamApiError && error.status < 500) break;
          await wait(RETRY_MS);
        }
      }
      router.push(`/exam/result?attempt=${id}`);
    },
    [router]
  );

  const flush = useCallback(async () => {
    if (flushing.current || !attemptId) return;
    flushing.current = true;
    try {
      while (pending.current.size > 0) {
        const [questionId, value] = pending.current.entries().next().value as [string, Entry];
        setSaveState("saving");
        try {
          await saveAnswer(attemptId, questionId, value);
          if (pending.current.get(questionId) === value) pending.current.delete(questionId);
        } catch (error) {
          if (error instanceof ExamApiError && error.status === 409) {
            // Closed on the server (time up or already submitted).
            pending.current.clear();
            void finish(attemptId);
            return;
          }
          if (error instanceof ExamApiError && error.status < 500) {
            pending.current.delete(questionId);
            continue;
          }
          setSaveState("offline");
          await wait(RETRY_MS);
        }
      }
      setSaveState("saved");
    } finally {
      flushing.current = false;
    }
  }, [attemptId, finish]);

  // Start or resume, then restore every saved answer and flag from the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { attempt } = await startAttempt(packId);
        const data = await loadAttempt(attempt.id);
        if (cancelled) return;
        const restored: Record<string, Entry> = {};
        for (const a of data.answers) {
          restored[a.questionId] = { selectedChoice: a.selectedChoice, flagged: a.state === "flagged" };
        }
        setAttemptId(attempt.id);
        setQuestions(data.questions);
        setEntries(restored);
        setDeadline(Date.now() + data.attempt.secondsLeft * 1000);
        setSecondsLeft(data.attempt.secondsLeft);
        setPhase("ready");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [packId]);

  // Countdown from the server's secondsLeft. Decorative: the server refuses
  // late writes on its own clock; reaching zero here just triggers submit.
  useEffect(() => {
    if (phase !== "ready") return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) void finish(attemptId);
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, deadline, attemptId, finish]);

  // Warn before leaving with saves still in flight.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const total = questions.length;
  const q = questions[index];
  const entry = (q && entries[q.id]) || { selectedChoice: null, flagged: false };

  const update = useCallback(
    (patch: Partial<Entry>) => {
      if (!q || phase !== "ready") return;
      setEntries((prev) => {
        const next = { ...(prev[q.id] ?? { selectedChoice: null, flagged: false }), ...patch };
        pending.current.set(q.id, next);
        return { ...prev, [q.id]: next };
      });
      queueMicrotask(() => void flush());
    },
    [q, phase, flush]
  );

  const go = useCallback((i: number) => setIndex(Math.min(Math.max(0, i), Math.max(0, total - 1))), [total]);
  const pick = useCallback((k: string | null) => update({ selectedChoice: k }), [update]);
  const toggleFlag = useCallback(() => update({ flagged: !entry.flagged }), [update, entry.flagged]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT" || !q) return;
      const choice = q.choices.find((c) => c.key === e.key);
      if (choice) pick(choice.key);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "ArrowRight") go(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, index, go, pick]);

  const answeredCount = useMemo(
    () => questions.filter((x) => entries[x.id]?.selectedChoice).length,
    [questions, entries]
  );
  const flagCount = useMemo(() => questions.filter((x) => entries[x.id]?.flagged).length, [questions, entries]);
  const subjects = useMemo(
    () =>
      SUBJECT_ORDER.map((id) => {
        const idx = questions.map((x, i) => (x.subject === id ? i : -1)).filter((i) => i > -1);
        return { id, ...SUBJECT_META[id], first: idx[0] ?? -1, idx };
      }).filter((s) => s.idx.length > 0),
    [questions]
  );

  if (phase === "loading" || phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center">
        {phase === "loading" ? (
          <>
            <Icon name="hourglass_top" size={36} className="text-brand" />
            <p className="font-display text-[17px] font-medium text-ink2">กำลังเตรียมข้อสอบ…</p>
          </>
        ) : (
          <>
            <Icon name="error" size={36} className="text-red" />
            <p className="font-display text-[17px] font-medium">เปิดข้อสอบไม่สำเร็จ</p>
            <p className="max-w-[420px] text-[15px] text-ink2">{loadError}</p>
            <Button href="/exam" kind="ghost" icon="arrow_back">กลับไปคลังข้อสอบ</Button>
          </>
        )}
      </div>
    );
  }

  const subject = SUBJECT_META[q.subject];
  const pct = total > 0 ? answeredCount / total : 0;
  const remaining = total - answeredCount;
  const reached = Math.round(pct * 100);
  const nextMilestone = MILESTONES.find((m) => m > reached) ?? 100;
  const toMilestone = Math.max(0, Math.ceil((nextMilestone / 100) * total) - answeredCount);
  const timer = formatClock(secondsLeft);
  const ringLen = 2 * Math.PI * 70;
  const canSubmit = phase === "ready" && answeredCount === total;

  const pill =
    saveState === "saved"
      ? { cls: "bg-green-50 text-green", icon: "cloud_done", text: "เซฟให้แล้ว" }
      : saveState === "saving"
        ? { cls: "bg-brand-50 text-brand-dark", icon: "cloud_sync", text: "กำลังเซฟ…" }
        : { cls: "bg-amber-50 text-amber-ink", icon: "cloud_off", text: "ออฟไลน์ กำลังลองใหม่" };

  return (
    <div className="flex flex-1 flex-col">
      {/* exam bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card px-5 py-3.5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex size-[46px] items-center justify-center rounded-full bg-gradient-to-br from-mystic to-brand font-display text-[19px] font-semibold text-on-fill">
            {studentName.slice(0, 1)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-[16px] font-semibold">{studentName}</span>
            </div>
            <p className="text-[12.5px] text-ink3">{packTitle} · {total} ข้อ</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] ${pill.cls}`} aria-live="polite">
            <Icon name={pill.icon} size={17} />{pill.text}
          </span>
          <span className="tabular inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-4 py-2 font-display text-[17px] font-medium text-accent-dark">
            <Icon name="timer" size={19} />{timer}
          </span>
          <Link
            href="/exam"
            title="คำตอบเซฟไว้บนเซิร์ฟเวอร์แล้ว กลับมาทำต่อได้ แต่เวลายังนับต่อ"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-[1.5px] border-border-strong bg-card px-4 py-2 font-display text-[14.5px] font-medium text-ink2"
          >
            <Icon name="logout" size={17} />ออกไปก่อน
          </Link>
        </div>
      </div>

      {/* subject tabs */}
      <div className="border-b border-border bg-card px-5 pb-3.5 md:px-10">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="วิชา">
          {subjects.map((s) => {
            const on = s.id === q.subject;
            const done = s.idx.filter((i) => entries[questions[i].id]?.selectedChoice).length;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => go(s.first)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border-[1.5px] px-[18px] py-2 font-display text-[14.5px] font-medium ${
                  on ? "border-brand bg-brand-50 text-brand-dark" : "border-border bg-page text-ink2"
                }`}
              >
                <Icon name={s.icon} size={18} className={on ? "text-brand" : "text-ink3"} />
                {s.label}
                <span className={`tabular font-sans text-[13px] font-normal ${on ? "text-brand" : "text-ink3"}`}>{done}/{s.idx.length}</span>
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
                {answeredCount >= total ? "ครบทุกข้อแล้ว" : `อีก ${toMilestone} ข้อถึงด่าน ${nextMilestone}%`}
              </span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-page" aria-hidden>
              <div className="h-full rounded-full bg-mystic" style={{ width: `${pct * 100}%` }} />
            </div>
            <ol className="flex justify-between">
              {MILESTONES.map((m) => {
                const need = Math.ceil((m / 100) * total);
                const done = answeredCount >= need;
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
                      {m === 100 ? "จบชุด" : done ? `ครบ ${need} ข้อ` : next ? `อีก ${need - answeredCount} ข้อ` : `ด่าน ${need} ข้อ`}
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
              <h3 id="q-title" className="whitespace-nowrap text-[22px] font-semibold">ข้อ {index + 1}</h3>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 font-display text-[13.5px] font-medium text-brand-dark">
                <Icon name={subject.icon} size={17} />{subject.label} · {q.topic}
              </span>
              <button
                type="button"
                aria-pressed={entry.flagged}
                onClick={toggleFlag}
                className={`ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] px-[18px] py-2 font-display text-[14.5px] font-medium ${
                  entry.flagged ? "border-red bg-red-50 text-red" : "border-border-strong bg-card text-ink2"
                }`}
              >
                <Icon name="flag" size={19} fill={entry.flagged} />
                {entry.flagged ? "ปักธงไว้แล้ว" : "ปักธงไว้ทบทวน"}
              </button>
            </div>

            <p className="my-[18px] whitespace-pre-line text-[18px] leading-[1.85] md:text-[20px]">{q.prompt}</p>

            {q.imageUrl ? (
              <div className="flex justify-center rounded-[18px] border border-border-strong bg-page p-[22px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded question figure */}
                <img src={q.imageUrl} alt={`รูปประกอบโจทย์ข้อ ${index + 1}`} className="max-h-[360px] max-w-full object-contain" />
              </div>
            ) : null}

            <div className="mt-[18px] flex flex-col gap-3" role="radiogroup" aria-label="ตัวเลือกคำตอบ">
              {q.choices.map((c) => {
                const on = entry.selectedChoice === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pick(c.key)}
                    className={`flex w-full items-center gap-4 rounded-[20px] border bg-card px-5 py-4 text-left transition-colors ${
                      on ? "border-2 border-brand bg-brand-50" : "border-[1.5px] border-border hover:border-border-strong"
                    }`}
                  >
                    <span
                      className={`flex size-[42px] shrink-0 items-center justify-center rounded-[14px] border font-display text-[17px] font-medium ${
                        on ? "border-brand bg-brand text-on-fill" : "border-border bg-page text-ink2"
                      }`}
                    >
                      {c.key}
                    </span>
                    <span className="tabular flex-1 text-[17.5px]">{c.text}</span>
                    <Icon name="check_circle" size={24} fill className={`text-brand ${on ? "opacity-100" : "opacity-0"}`} />
                  </button>
                );
              })}
            </div>

            <div className="mt-[22px] flex flex-wrap items-center justify-between gap-3.5">
              <Button kind="ghost" icon="arrow_back" onClick={() => go(index - 1)} disabled={index === 0}>ข้อก่อนหน้า</Button>
              <button type="button" onClick={() => pick(null)} className="inline-flex items-center gap-2 font-display text-[14.5px] font-medium text-ink3">
                <Icon name="backspace" size={18} />ล้างคำตอบข้อนี้
              </button>
              <Button kind="brand" icon="arrow_forward" trailingIcon onClick={() => go(index + 1)} disabled={index === total - 1}>ข้อถัดไป</Button>
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
                  strokeDashoffset={ringLen * (1 - pct)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="tabular font-display text-[41px] font-semibold leading-[1.18]">{answeredCount}</span>
                <span className="text-[15px] text-ink3">จาก {total} ข้อ</span>
              </div>
            </div>
            <p className="text-center text-[13.5px] text-ink3">ตอบแล้ว {answeredCount} ข้อ · ปักธงไว้ {flagCount} ข้อ</p>
          </div>

          <div className="flex flex-wrap gap-[5px]" aria-label="ตารางข้อสอบ">
            {questions.map((x, i) => {
              const e = entries[x.id];
              const cls =
                i === index
                  ? "border-brand bg-brand text-on-fill"
                  : e?.flagged
                    ? "border-red bg-red text-on-fill"
                    : e?.selectedChoice
                      ? "border-green bg-green text-on-fill"
                      : "border-border bg-page text-ink3";
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-label={`ข้อ ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => go(i)}
                  className={`tabular flex size-[26px] items-center justify-center rounded-[8px] border font-display text-[10px] ${cls}`}
                >
                  {i + 1}
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
            <p className="flex items-start gap-2"><Icon name="flag" size={17} fill className="text-red" />ปักธงรอทบทวน {flagCount} ข้อ</p>
            <p className="flex items-start gap-2"><Icon name="timer" size={17} className="text-accent-dark" />เหลือเวลา {timer} หมดเวลาระบบส่งให้เอง</p>
          </div>

          <Button icon="task_alt" className="w-full" disabled={!canSubmit} onClick={() => void finish(attemptId)}>
            {phase === "submitting" ? "กำลังส่งคำตอบ…" : "ส่งคำตอบและตรวจ"}
          </Button>
          <p className="text-center text-[12.5px] text-ink3">ส่งได้เมื่อทำครบทุกข้อ หรือเมื่อหมดเวลา</p>
        </aside>
      </div>
    </div>
  );
}
