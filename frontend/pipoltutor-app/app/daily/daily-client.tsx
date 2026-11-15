"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FireCard } from "@/components/fire-card";
import { Icon } from "@/components/ui";
/** Figures may only be our uploads or https links; anything else is dropped. */
const isHttpsUrl = (u: string) => /^https:\/\/\S+$/i.test(u);
const isFigureUrl = (u: string) => /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(u) || isHttpsUrl(u);
type Answer = { selectedChoices: string[]; textAnswer: string | null };
type Question = {
  id: string;
  type: "single" | "multiple" | "short";
  subject: string;
  topic: string;
  prompt: string;
  imageUrls?: string[];
  linkUrls?: string[];
  choices: { key: string; text: string }[];
  tries: number;
  correct: boolean;
  lastAnswer: Answer | null;
  hint: string | null;
  correctChoices?: string[];
  acceptedAnswers?: string[];
  explanation?: string;
};
type Daily = {
  date: string;
  title: string;
  archive: boolean;
  /** FIRE-12 Extend: this learner may still answer until this instant. */
  extendedUntil?: string | null;
  /** On today's view: yesterday's challenge is still open for this learner. */
  pastExtension?: { date: string; until: string } | null;
  questions: Question[];
};
const bangkokTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
const input =
  "min-h-[48px] w-full rounded-[12px] border border-border bg-card px-4 py-2 text-[16px] leading-[1.7]";
export function DailyClient({
  date,
  loggedIn,
}: {
  date?: string;
  loggedIn: boolean;
}) {
  const [data, setData] = useState<Daily | null>(null),
    [answers, setAnswers] = useState<Record<string, Answer>>({}),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [days, setDays] = useState<
      { date: string; title: string; questions?: number }[]
    >([]),
    [practice, setPractice] = useState<
      Record<string, { correct: boolean; explanation: string }>
    >({}),
    [tick, setTick] = useState(0);
  const pending = useRef<Record<string, { body: string; id: string }>>({});
  const router = useRouter();
  // Past days that had questions, other than the one on screen (FIRE-06).
  const practisable = days.filter(
    (d) => d.questions !== 0 && d.date !== data?.date,
  );
  function openRandomDay() {
    const pick = practisable[Math.floor(Math.random() * practisable.length)];
    if (pick) router.push(`/daily?date=${pick.date}`);
  }
  useEffect(() => {
    fetch(date ? `/api/daily/archive/${date}` : "/api/daily/today", {
      cache: "no-store",
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "โหลดโจทย์ไม่สำเร็จ");
        return body as Daily;
      })
      .then((d) => {
        setData(d);
        setAnswers(
          Object.fromEntries(
            d.questions.map((q) => [
              q.id,
              q.lastAnswer ?? { selectedChoices: [], textAnswer: null },
            ]),
          ),
        );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "โหลดโจทย์ไม่สำเร็จ"),
      );
    fetch("/api/daily/archive")
      .then((r) => r.json())
      .then((d) => setDays(d.days ?? []))
      .catch(() => {});
  }, [date]);
  async function submit(q: Question) {
    if (!data) return;
    setBusy(q.id);
    setError("");
    setNote("");
    try {
      if (!navigator.onLine)
        throw new Error("โจทย์ประจำวันต้องเชื่อมต่ออินเทอร์เน็ต กรุณาออนไลน์แล้วลองใหม่");
      const answer = answers[q.id] ?? { selectedChoices: [], textAnswer: null };
      const key = JSON.stringify(answer);
      if (!pending.current[q.id] || pending.current[q.id]!.body !== key)
        pending.current[q.id] = { body: key, id: crypto.randomUUID() };
      const r = await fetch(
        data.archive
          ? `/api/daily/archive/${data.date}/practice`
          : "/api/daily/submit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: data.date,
            questionId: q.id,
            answer,
            requestId: pending.current[q.id]!.id,
          }),
        },
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "ส่งคำตอบไม่สำเร็จ");
      delete pending.current[q.id];
      if (data.archive) setPractice({ ...practice, [q.id]: body });
      else {
        setData({ ...body.daily, pastExtension: data.pastExtension });
        setTick((t) => t + 1);
        setNote(
          body.correct
            ? body.daily.questions.every((item: Question) => item.correct)
              ? "ทำถูกครบแล้ว วันนี้ได้รับไฟ +1"
              : "ถูกต้อง! ทำถูกครบทุกข้อเพื่อเพิ่มไฟวันนี้"
            : q.tries >= 1
              ? "ใช้สิทธิ์ครบแล้ว ดูคำอธิบายตามเวลาที่กำหนด"
              : "ยังไม่ถูก ลองอีกครั้งได้อีก 1 ครั้ง",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ติดต่อระบบไม่ได้ กรุณาลองใหม่");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
      <header>
        <h1 className="text-[30px] font-semibold leading-[1.35]">
          {date && !data?.extendedUntil ? "ฝึกโจทย์ย้อนหลัง" : "โจทย์ประจำวัน"}
        </h1>
        <p className="mt-3 text-[16px] text-ink2">
          {data?.extendedUntil
            ? `ขยายเวลาเนื่องจากระบบขัดข้อง ตอบได้ถึง ${bangkokTime(data.extendedUntil)} ผลนับเป็นไฟของวันที่ ${data.date}`
            : date
              ? "ฝึกซ้ำได้ไม่จำกัด การฝึกย้อนหลังไม่เพิ่มหรือรักษาไฟ"
              : "ตอบได้ข้อละ 2 ครั้ง ทำถูกครบทุกข้อเพิ่มไฟ +1 สูงสุดวันละครั้ง ปิดรับ 23:59 น. เวลาไทย"}
        </p>
      </header>
      {data?.pastExtension ? (
        <Link
          href={`/daily?date=${data.pastExtension.date}`}
          className="rounded-[12px] border border-border bg-amber-50 p-4 text-amber-ink"
        >
          โจทย์ของวันที่ {data.pastExtension.date} ได้รับการขยายเวลาถึง{" "}
          {bangkokTime(data.pastExtension.until)} แตะเพื่อทำต่อ
        </Link>
      ) : null}
      {loggedIn && (!date || data?.extendedUntil) ? <FireCard key={tick} /> : null}
      {!loggedIn && !date ? (
        <Link
          href="/login?next=%2Fdaily"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand px-6 font-medium text-on-fill"
        >
          เข้าสู่ระบบด้วย Google เพื่อทำโจทย์
        </Link>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-[12px] bg-red-50 p-4 text-red">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="rounded-[12px] bg-brand-50 p-4 text-ink">
          {note}
        </p>
      ) : null}
      {!data && !error ? <p role="status">กำลังโหลดโจทย์…</p> : null}
      {data ? (
        <>
          <h2 className="text-[22px] font-semibold">{data.title}</h2>
          {data.questions.map((q, i) => {
            const a = answers[q.id] ?? {
              selectedChoices: [],
              textAnswer: null,
            };
            const finished = !data.archive && (q.correct || q.tries >= 2);
            return (
              <section
                key={q.id}
                role={q.type === "single" ? "radiogroup" : "group"}
                aria-labelledby={`daily-question-${q.id}`}
                className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-5"
              >
                <h3
                  id={`daily-question-${q.id}`}
                  className="text-[19px] font-medium leading-[1.7]"
                >
                  ข้อ {i + 1}: {q.prompt}
                </h3>
                {(q.imageUrls ?? []).filter(isFigureUrl).map((url, k) => (
                  <a key={`${k}-${url}`} href={url} target="_blank" rel="noopener noreferrer" className="flex justify-center rounded-[16px] border border-border bg-page p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin-provided question figure */}
                    <img src={url} alt={`รูปประกอบโจทย์ข้อ ${i + 1}`} className="max-h-[320px] max-w-full object-contain" />
                  </a>
                ))}
                {(q.linkUrls ?? []).filter(isHttpsUrl).map((url, k) => (
                  <a key={`${k}-${url}`} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[15px] text-brand underline">
                    <Icon name="open_in_new" size={18} />
                    เปิดเอกสารประกอบ{(q.linkUrls ?? []).length > 1 ? ` ${k + 1}` : ""}
                  </a>
                ))}
                <p className="text-[14px] text-ink2">
                  {q.topic}
                  {!data.archive ? ` · ใช้โอกาส ${q.tries}/2` : ""}
                </p>
                {q.type === "short" ? (
                  <input
                    aria-label={`คำตอบข้อ ${i + 1}`}
                    disabled={finished || busy !== null}
                    className={input}
                    value={a.textAnswer ?? ""}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        [q.id]: {
                          selectedChoices: [],
                          textAnswer: e.target.value,
                        },
                      })
                    }
                  />
                ) : (
                  q.choices.map((c) => (
                    <label
                      key={c.key}
                      className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[12px] border p-4 text-[16px] ${a.selectedChoices.includes(c.key) ? "border-brand bg-brand-50" : "border-border"}`}
                    >
                      <input
                        type={q.type === "single" ? "radio" : "checkbox"}
                        name={q.id}
                        disabled={finished || busy !== null}
                        checked={a.selectedChoices.includes(c.key)}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            [q.id]: {
                              textAnswer: null,
                              selectedChoices:
                                q.type === "single"
                                  ? [c.key]
                                  : e.target.checked
                                    ? [...a.selectedChoices, c.key]
                                    : a.selectedChoices.filter(
                                        (k) => k !== c.key,
                                      ),
                            },
                          })
                        }
                      />
                      <span>
                        {c.key}. {c.text}
                      </span>
                    </label>
                  ))
                )}
                {q.hint ? (
                  <p className="rounded-[12px] bg-amber-50 p-4 text-amber-ink">
                    คำใบ้: {q.hint}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={
                    finished || busy !== null || (!data.archive && !loggedIn)
                  }
                  onClick={() => void submit(q)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 self-start rounded-full bg-brand px-6 font-medium text-on-fill disabled:opacity-50"
                >
                  <Icon name={q.correct ? "check_circle" : "send"} />
                  {busy === q.id
                    ? "กำลังส่ง…"
                    : q.correct && !data.archive
                      ? "ตอบถูกแล้ว"
                      : finished
                        ? "หมดโอกาสแล้ว"
                        : data.archive
                          ? "ตรวจคำตอบฝึก"
                          : "ส่งคำตอบ"}
                </button>
                {practice[q.id] ? (
                  <p role="status">
                    {practice[q.id]!.correct
                      ? "ถูกต้อง"
                      : "ยังไม่ถูก ลองฝึกซ้ำได้ไม่จำกัด"}
                  </p>
                ) : null}
                {/* Past days: the key stays hidden until this question was practised (FIRE-06). */}
                {q.explanation !== undefined &&
                (!data.archive || practice[q.id]) ? (
                  <div className="rounded-[12px] bg-green-50 p-4">
                    <p>
                      คำตอบ:{" "}
                      {[
                        ...(q.correctChoices ?? []),
                        ...(q.acceptedAnswers ?? []),
                      ].join(", ")}
                    </p>
                    <p>{q.explanation}</p>
                  </div>
                ) : null}
              </section>
            );
          })}
        </>
      ) : null}
      <section id="archive" className="scroll-mt-6 border-t border-border pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-[21px] font-semibold">โจทย์ที่ผ่านมา</h2>
          {practisable.length ? (
            <button
              type="button"
              onClick={openRandomDay}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] border-border-strong bg-card px-5 font-display text-[15px] font-medium text-ink"
            >
              <Icon name="shuffle" size={20} />
              สุ่มโจทย์มาฝึก
            </button>
          ) : null}
        </div>
        <p className="mb-3 text-[14.5px] text-ink2">
          ฝึกซ้ำได้ไม่จำกัด เฉลยขึ้นหลังส่งคำตอบ และไม่มีผลกับไฟ
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {days.map((d) => (
            <li key={d.date}>
              <Link
                href={`/daily?date=${d.date}`}
                className="flex min-h-[48px] items-center rounded-[12px] border border-border bg-card p-4 text-brand"
              >
                {d.date} · {d.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
