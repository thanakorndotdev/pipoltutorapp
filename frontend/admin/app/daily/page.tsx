"use client";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Field,
  Note,
  PageHeader,
  inputClass,
} from "@/components/ui";
import { useAdmin, errorMessage } from "@/lib/admin";
import { QuestionForm } from "@/components/question-form";
import { SUBJECTS } from "@/lib/types";
type Q = {
  id: string;
  type: "single" | "multiple" | "short";
  subject: string;
  topic: string;
  prompt: string;
  choices: { key: string; text: string }[];
  correctChoices: string[];
  acceptedAnswers: string[];
  hint: string;
  showHint: boolean;
  explanation: string;
  reveal: "finished" | "next_day";
  imageUrls?: string[];
  linkUrls?: string[];
  /** Set when the item was picked from the exam bank; the bank stays the place to edit its text. */
  sourceQuestionId?: string;
};
type BankQuestion = {
  id: string;
  subject: string;
  topic: string;
  prompt: string;
  imageUrls: string[];
  linkUrls: string[];
  type: Q["type"];
  choices: { key: string; text: string }[];
  correctChoices: string[];
  acceptedAnswers: string[];
  explanation: string | null;
  inPublishedPacks: number;
  usedInDaily: number;
};
const fromBank = (b: BankQuestion): Q => ({
  id: crypto.randomUUID(),
  sourceQuestionId: b.id,
  type: b.type,
  subject: b.subject,
  topic: b.topic,
  prompt: b.prompt,
  choices: b.choices,
  correctChoices: b.correctChoices,
  acceptedAnswers: b.acceptedAnswers,
  imageUrls: b.imageUrls,
  linkUrls: b.linkUrls,
  hint: "",
  showHint: true,
  explanation: b.explanation ?? "",
  reveal: "next_day",
});
const draftBody = (c: Challenge) => ({
  title: c.title,
  date: c.date,
  status: c.status,
  queueOrder: c.queueOrder,
  questions: c.questions,
});
type Challenge = {
  id: string;
  title: string;
  date: string | null;
  status: string;
  queueOrder: number;
  questions: Q[];
};
type Plan = {
  previewId: string;
  affectedUsers?: number;
  affectedResponses?: number;
  count?: number;
  affected?: number;
  everyone?: boolean;
  until?: string | null;
};
/** Bangkok wall-clock "YYYY-MM-DDTHH:mm" from a datetime-local input, as an instant. */
const bangkokInstant = (local: string) =>
  local ? new Date(`${local}:00+07:00`).toISOString() : "";
const bangkokToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
export default function Page() {
  const { api, download } = useAdmin();
  const [items, setItems] = useState<Challenge[]>([]),
    [draft, setDraft] = useState<Challenge | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [writing, setWriting] = useState(false),
    [topics, setTopics] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [keepFire, setKeepFire] = useState(true),
    [resetTries, setResetTries] = useState(false),
    [plan, setPlan] = useState<
      (Plan & { kind: "edit" | "import" | "outage" }) | null
    >(null),
    [analytics, setAnalytics] = useState<{
      byDay: {
        date: string;
        participants: number;
        increased: number;
        successPct: number | null;
      }[];
      byQuestion: {
        date: string;
        questionId: string;
        prompt: string | null;
        topic: string | null;
        users: number;
        correctUsers: number;
        firstTryCorrect: number;
        hints: number;
        successPct: number | null;
      }[];
      weakTopics: {
        subject: string;
        topic: string;
        users: number;
        wrongUsers: number;
        wrongPct: number | null;
      }[];
      responses: {
        userId: string;
        date: string;
        questionId: string;
        tryNo: number;
        correct: boolean;
        hintShown: boolean;
      }[];
      summaries: { userId: string; current: number; highest: number }[];
      ledger: {
        userId: string;
        date: string;
        state: string;
        increment: number;
      }[];
      recoveries: { userId: string; missedDate: string; month: string }[];
    } | null>(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [mode, setMode] = useState("protect"),
    [until, setUntil] = useState("");
  useEffect(() => {
    api<{ challenges: Challenge[] }>("/admin/daily")
      .then((r) => setItems(r.challenges))
      .catch((e) => setError(errorMessage(e)));
  }, [api]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setItems(
      (await api<{ challenges: Challenge[] }>("/admin/daily")).challenges,
    );
    setPlan(null);
  }
  const patch = (p: Partial<Challenge>) =>
    draft && setDraft({ ...draft, ...p });
  const patchQ = (i: number, p: Partial<Q>) =>
    draft &&
    patch({
      questions: draft.questions.map((q, j) => (j === i ? { ...q, ...p } : q)),
    });
  return (
    <>
      <PageHeader
        title="โจทย์ประจำวันและ Fire"
        sub="ตั้งวันแน่นอนหรือคิวสำรอง ทุกระดับชั้นใช้โจทย์เดียวกัน วันใหม่เริ่ม 00:00 น. เวลาไทย"
      />
      <Note>
        วิธีที่แนะนำ: เขียนโจทย์เก็บไว้ใน <a className="text-brand underline" href="/admin/questions/">คลังข้อสอบ</a> ก่อน (ใส่รูปได้) แล้วกด
        &quot;สร้างชุดโจทย์ประจำวัน&quot; → เลือกโจทย์จากคลัง → ตั้งวันที่ หรือเว้นว่างไว้เป็นคิวสำรองสำหรับวันที่ไม่มีโจทย์
      </Note>
      {error ? <Note tone="error">{error}</Note> : null}
      {notice ? <Note tone="ok">{notice}</Note> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setDraft({
              id: "",
              title: "",
              date: null,
              status: "scheduled",
              queueOrder: 0,
              questions: [],
            });
            setPlan(null);
          }}
        >
          สร้างชุดโจทย์ประจำวัน
        </Button>
        <Button
          kind="ghost"
          onClick={() => void run(() => download("/admin/daily/template"))}
        >
          ดาวน์โหลดเทมเพลต CSV
        </Button>
        <Button
          kind="ghost"
          onClick={() =>
            void run(async () =>
              setAnalytics(await api("/admin/daily/analytics")),
            )
          }
        >
          ผลตอบและประวัติ Fire
        </Button>
      </div>
      <Card>
        <ul className="divide-y divide-border">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="mr-auto">
                <b>{c.title}</b>
                <p className="text-[14px] text-ink2">
                  {c.date ?? `คิวสำรองลำดับ ${c.queueOrder}`} ·{" "}
                  {c.status === "draft" ? "ฉบับร่าง (ยังไม่ถูกใช้)" : c.status === "scheduled" ? "พร้อมใช้" : c.status} ·{" "}
                  {c.questions.length} ข้อ
                </p>
              </div>
              <Button
                kind="ghost"
                onClick={() => {
                  setDraft(structuredClone(c));
                  setPlan(null);
                }}
              >
                แก้ไข / ตรวจใหม่
              </Button>
              <Button
                kind="ghost"
                onClick={() =>
                  setDraft({
                    ...structuredClone(c),
                    id: "",
                    title: `${c.title} (สำเนา)`,
                    date: null,
                    status: "draft",
                    questions: c.questions.map((q) => ({
                      ...q,
                      id: crypto.randomUUID(),
                    })),
                  })
                }
              >
                คัดลอก
              </Button>
            </li>
          ))}
        </ul>
        {!items.length ? <p>ยังไม่มีโจทย์ประจำวัน</p> : null}
      </Card>
      {draft ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-[20px] font-semibold">
            {draft.id ? "แก้ไขชุดโจทย์" : "สร้างชุดโจทย์ประจำวัน"}
          </h2>
          <Field id="title" label="ชื่อชุดโจทย์">
            <input
              id="title"
              className={inputClass}
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="date" label="วันที่ (เว้นว่าง = คิวสำรอง)">
              <input
                id="date"
                type="date"
                className={inputClass}
                value={draft.date ?? ""}
                onChange={(e) => patch({ date: e.target.value || null })}
              />
            </Field>
            <Field id="status" label="สถานะ">
              <select
                id="status"
                className={inputClass}
                value={draft.status}
                onChange={(e) => patch({ status: e.target.value })}
              >
                <option value="scheduled">พร้อมใช้ (ระบบดึงไปใช้ตามวัน/คิว)</option>
                <option value="draft">ฉบับร่าง (ยังไม่ถูกใช้)</option>
              </select>
            </Field>
            <Field id="order" label="ลำดับคิวสำรอง">
              <input
                id="order"
                type="number"
                min={0}
                className={inputClass}
                value={draft.queueOrder}
                onChange={(e) => patch({ queueOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <BankPicker
            onTopics={setTopics}
            picked={new Set(draft.questions.map((q) => q.sourceQuestionId).filter((x): x is string => !!x))}
            onPick={(b) => patch({ questions: [...draft.questions, fromBank(b)] })}
          />
          {!draft.questions.length ? (
            <Note tone="warn">ยังไม่มีโจทย์ในชุดนี้ เลือกจากคลังด้านบน หรือกด &quot;เขียนโจทย์ใหม่&quot;</Note>
          ) : null}
          {draft.questions.map((q, i) => q.sourceQuestionId ? (
            <fieldset key={q.id} className="flex flex-col gap-3 rounded-[14px] border border-border p-4">
              <legend className="px-2 font-medium">ข้อ {i + 1} · จากคลังข้อสอบ</legend>
              <p className="text-[14px] text-ink2">{q.topic} · {q.type === "short" ? "เติมคำตอบ" : q.type === "multiple" ? "เลือกหลายข้อ" : "เลือกข้อเดียว"}</p>
              <p className="whitespace-pre-wrap text-[16px]">{q.prompt}</p>
              {(q.imageUrls ?? []).length ? (
                <div className="flex flex-wrap gap-2">
                  {(q.imageUrls ?? []).map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element -- question figure preview
                    <img key={u} src={u} alt="" className="max-h-[120px] rounded-[10px] border border-border object-contain" />
                  ))}
                </div>
              ) : null}
              {q.type === "short" ? (
                <p className="text-[14.5px]">คำตอบที่รับ: <b>{q.acceptedAnswers.join(" | ")}</b></p>
              ) : (
                <ul className="text-[14.5px]">
                  {q.choices.map((c) => (
                    <li key={c.key} className={q.correctChoices.includes(c.key) ? "font-semibold text-green" : ""}>
                      {c.key}. {c.text} {q.correctChoices.includes(c.key) ? "✓" : ""}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[13.5px] text-ink3">ชุดนี้เก็บสำเนาโจทย์ไว้ การแก้ในคลังภายหลังไม่เปลี่ยนชุดนี้ ถ้าต้องการแก้ข้อความ ให้แก้ในคลังแล้วลบข้อนี้และเลือกใหม่</p>
              <input
                aria-label={`คำใบ้ข้อ ${i + 1}`}
                className={inputClass}
                value={q.hint}
                onChange={(e) => patchQ(i, { hint: e.target.value })}
                placeholder="คำใบ้หลังผิดครั้งแรก (ไม่บังคับ)"
              />
              <label className="flex min-h-[44px] items-center gap-2">
                <input type="checkbox" checked={q.showHint} onChange={(e) => patchQ(i, { showHint: e.target.checked })} />
                เปิดคำใบ้หลังผิดครั้งแรก
              </label>
              <select
                aria-label={`เวลาเผยเฉลยข้อ ${i + 1}`}
                className={inputClass}
                value={q.reveal}
                onChange={(e) => patchQ(i, { reveal: e.target.value as Q["reveal"] })}
              >
                <option value="next_day">เผยเฉลยวันถัดไป</option>
                <option value="finished">เผยเมื่อหมดโอกาสหรือทำถูกแล้ว</option>
              </select>
              <Button kind="danger" onClick={() => patch({ questions: draft.questions.filter((_, j) => i !== j) })}>
                เอาข้อนี้ออกจากชุด
              </Button>
            </fieldset>
          ) : (
            <fieldset
              key={q.id}
              className="flex flex-col gap-3 rounded-[14px] border border-border p-4"
            >
              <legend className="px-2 font-medium">ข้อ {i + 1} · เขียนในชุดนี้</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  aria-label={`ประเภทข้อ ${i + 1}`}
                  className={inputClass}
                  value={q.type}
                  onChange={(e) =>
                    patchQ(i, { type: e.target.value as Q["type"] })
                  }
                >
                  <option value="single">เลือกข้อเดียว</option>
                  <option value="multiple">เลือกหลายข้อ</option>
                  <option value="short">เติมคำตอบ</option>
                </select>
                <select
                  aria-label={`วิชาข้อ ${i + 1}`}
                  className={inputClass}
                  value={q.subject}
                  onChange={(e) => patchQ(i, { subject: e.target.value })}
                >
                  {[
                    ["math", "คณิตศาสตร์"],
                    ["science", "วิทยาศาสตร์"],
                    ["general_aptitude", "ความสามารถทั่วไป"],
                    ["thai", "ภาษาไทย"],
                    ["english", "ภาษาอังกฤษ"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`หัวข้อข้อ ${i + 1}`}
                  className={inputClass}
                  value={q.topic}
                  onChange={(e) => patchQ(i, { topic: e.target.value })}
                  placeholder="หัวข้อ"
                />
              </div>
              <textarea
                aria-label={`โจทย์ข้อ ${i + 1}`}
                rows={3}
                className={inputClass}
                value={q.prompt}
                onChange={(e) => patchQ(i, { prompt: e.target.value })}
                placeholder="ข้อความโจทย์"
              />
              {q.type !== "short" ? (
                <Field
                  id={`choices-${i}`}
                  label="ตัวเลือก (หนึ่งบรรทัดต่อหนึ่งตัวเลือก ระบบกำหนด A, B, C…)"
                >
                  <textarea
                    id={`choices-${i}`}
                    rows={4}
                    className={inputClass}
                    value={q.choices.map((c) => c.text).join("\n")}
                    onChange={(e) =>
                      patchQ(i, {
                        choices: e.target.value
                          .split("\n")
                          .map((text, j) => ({
                            key: String.fromCharCode(65 + j),
                            text,
                          })),
                      })
                    }
                  />
                </Field>
              ) : null}
              <Field
                id={`answer-${i}`}
                label={
                  q.type === "short"
                    ? "คำตอบที่รับ (คั่นด้วย |)"
                    : "เฉลย เช่น B หรือ A|C"
                }
              >
                <input
                  id={`answer-${i}`}
                  className={inputClass}
                  value={(q.type === "short"
                    ? q.acceptedAnswers
                    : q.correctChoices
                  ).join("|")}
                  onChange={(e) =>
                    patchQ(
                      i,
                      q.type === "short"
                        ? { acceptedAnswers: e.target.value.split("|") }
                        : {
                            correctChoices: e.target.value
                              .toUpperCase()
                              .split("|"),
                          },
                    )
                  }
                />
              </Field>
              <input
                aria-label={`คำใบ้ข้อ ${i + 1}`}
                className={inputClass}
                value={q.hint}
                onChange={(e) => patchQ(i, { hint: e.target.value })}
                placeholder="คำใบ้หลังผิดครั้งแรก"
              />
              <label className="flex min-h-[44px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={q.showHint}
                  onChange={(e) => patchQ(i, { showHint: e.target.checked })}
                />
                เปิดคำใบ้หลังผิดครั้งแรก
              </label>
              <textarea
                aria-label={`อธิบายเฉลยข้อ ${i + 1}`}
                className={inputClass}
                value={q.explanation}
                onChange={(e) => patchQ(i, { explanation: e.target.value })}
                placeholder="อธิบายเฉลย"
              />
              <select
                aria-label={`เวลาเผยเฉลยข้อ ${i + 1}`}
                className={inputClass}
                value={q.reveal}
                onChange={(e) =>
                  patchQ(i, { reveal: e.target.value as Q["reveal"] })
                }
              >
                <option value="next_day">เผยเฉลยวันถัดไป</option>
                <option value="finished">เผยเมื่อหมดโอกาสหรือทำถูกแล้ว</option>
              </select>
              <Button
                kind="danger"
                onClick={() =>
                  patch({
                    questions: draft.questions.filter((_, j) => i !== j),
                  })
                }
              >
                ลบข้อนี้
              </Button>
            </fieldset>
          ))}
          {writing ? (
            <section className="flex flex-col gap-3 rounded-[14px] border border-brand p-4">
              <h3 className="font-medium">เขียนโจทย์ใหม่ (บันทึกเข้าคลังข้อสอบ แล้วเพิ่มเข้าชุดนี้)</h3>
              <QuestionForm
                initial={null}
                topics={topics}
                onSubmit={async (input) => {
                  const { question } = await api<{ question: BankQuestion }>("/admin/daily/bank", { method: "POST", json: input });
                  patch({ questions: [...draft.questions, fromBank(question)] });
                  setWriting(false);
                }}
                onCancel={() => setWriting(false)}
              />
            </section>
          ) : (
            <Button kind="ghost" onClick={() => setWriting(true)}>
              เขียนโจทย์ใหม่
            </Button>
          )}
          {plan?.kind === "edit" ? (
            <section className="flex flex-col gap-3 rounded-[14px] border border-amber-icon p-4">
              <h3 className="font-medium">มีนักเรียนตอบชุดนี้แล้ว</h3>
              <p className="text-[14.5px]">
                ผู้ใช้ {plan.affectedUsers} คน · คำตอบ {plan.affectedResponses} รายการ ระบบจะตรวจคำตอบใหม่ตามเฉลยที่แก้
              </p>
              <label className="flex min-h-[44px] items-center gap-2">
                <input type="checkbox" checked={keepFire} onChange={(e) => setKeepFire(e.target.checked)} />
                คง Current Fire เดิมเมื่อเปลี่ยนเฉลย
              </label>
              <label className="flex min-h-[44px] items-center gap-2">
                <input type="checkbox" checked={resetTries} onChange={(e) => setResetTries(e.target.checked)} />
                คืนโอกาสโดยสร้างรหัสโจทย์ฉบับใหม่ (เก็บคำตอบเก่าไว้)
              </label>
              <Field id="reason" label="เหตุผลที่แก้ (บันทึกในประวัติ)">
                <input id="reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="flex gap-3">
                <Button
                  disabled={busy || reason.trim().length < 3}
                  onClick={() =>
                    void run(async () => {
                      const confirmed = await api<Plan>(`/admin/daily/${draft.id}/preview`, {
                        method: "POST",
                        json: { ...draftBody(draft), reason, keepFire, resetTries },
                      });
                      await api(`/admin/daily/${draft.id}/commit`, { method: "POST", json: { previewId: confirmed.previewId } });
                      setNotice(`บันทึกการแก้ไข "${draft.title}" และตรวจคำตอบใหม่แล้ว`);
                      setDraft(null);
                      await reload();
                    })
                  }
                >
                  ยืนยันบันทึกและตรวจใหม่
                </Button>
                <Button kind="ghost" onClick={() => setPlan(null)}>
                  กลับไปแก้ต่อ
                </Button>
              </div>
            </section>
          ) : null}
          <div className="flex gap-3">
            <Button
              disabled={busy || !draft.questions.length || plan?.kind === "edit"}
              onClick={() =>
                void run(async () => {
                  const body = draftBody(draft);
                  if (draft.id) {
                    // Nobody has answered yet: save straight away. Otherwise ask for a reason first (FIRE-13).
                    const p = await api<Plan>(`/admin/daily/${draft.id}/preview`, {
                      method: "POST",
                      json: { ...body, reason: "แก้ไขชุดโจทย์ก่อนมีผู้ตอบ", keepFire, resetTries },
                    });
                    if (!p.affectedResponses) {
                      await api(`/admin/daily/${draft.id}/commit`, { method: "POST", json: { previewId: p.previewId } });
                      setNotice(`บันทึกการแก้ไข "${draft.title}" แล้ว`);
                      setDraft(null);
                      await reload();
                    } else setPlan({ ...p, kind: "edit" });
                  } else {
                    await api("/admin/daily", { method: "POST", json: body });
                    setNotice(
                      draft.status === "draft"
                        ? `บันทึก "${draft.title}" เป็นฉบับร่างแล้ว ยังไม่ถูกใช้จนกว่าจะเปลี่ยนเป็นพร้อมใช้`
                        : `บันทึก "${draft.title}" แล้ว ${draft.date ? `ใช้วันที่ ${draft.date}` : "อยู่ในคิวสำรอง"}`,
                    );
                    setDraft(null);
                    await reload();
                  }
                })
              }
            >
              {draft.id ? "บันทึกการแก้ไข" : "บันทึกชุดโจทย์"}
            </Button>
            <Button
              kind="ghost"
              onClick={() => {
                setDraft(null);
                setPlan(null);
                setWriting(false);
              }}
            >
              ปิด
            </Button>
          </div>
          {error ? <Note tone="error">{error}</Note> : null}
        </Card>
      ) : null}
      <details className="rounded-[18px] border border-border bg-card p-4">
        <summary className="cursor-pointer font-medium">เครื่องมือเพิ่มเติม: นำเข้าไฟล์ CSV/XLSX และรักษาไฟเมื่อระบบขัดข้อง</summary>
        <div className="mt-4 flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-[19px] font-semibold">นำเข้าโจทย์</h2>
        <p className="text-[14px] text-ink2">
          ใช้ชื่อคอลัมน์ตามเทมเพลต รองรับ CSV ภาษาไทยและ XLSX
          ระบบจะแสดงตัวอย่างและตรวจทุกแถวก่อนยืนยัน
        </p>
        <input
          aria-label="เหตุผลนำเข้า"
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผล"
        />
        <input
          aria-label="ไฟล์โจทย์"
          type="file"
          accept=".csv,.xlsx"
          disabled={busy || reason.trim().length < 3}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              void run(async () => {
                const form = new FormData();
                form.set("file", f);
                form.set("reason", reason);
                setPlan({
                  ...(await api<Plan>("/admin/daily/import", {
                    method: "POST",
                    body: form,
                  })),
                  kind: "import",
                });
              });
          }}
        />
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-[19px] font-semibold">
          รักษาหรือชดเชย Fire เมื่อระบบขัดข้อง
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            aria-label="ตั้งแต่วันที่"
            type="date"
            className={inputClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            aria-label="ถึงวันที่"
            type="date"
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <select
          aria-label="วิธีชดเชย"
          className={inputClass}
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            if (e.target.value === "extend") {
              const today = bangkokToday();
              setFrom(today);
              setTo(today);
            }
          }}
        >
          <option value="protect">รักษา ไม่เพิ่มไม่เสีย</option>
          <option value="bulk_recover">กู้ให้ทั้งหมดโดยไม่ใช้โควตา</option>
          <option value="compensate">ชดเชย +1 ต่อวันที่เลือก</option>
          <option value="extend">ขยายเวลาปิดรับโจทย์วันนี้</option>
        </select>
        {mode === "extend" ? (
          <>
            <label className="flex flex-col gap-1 text-[15px]">
              เปิดรับคำตอบของวันนี้ถึง (เวลาไทย)
              <input
                type="datetime-local"
                className={inputClass}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
            <p className="text-[14px] text-ink2">
              ใช้ได้เฉพาะก่อนปิดรับ 23:59:59 น. ของวันนี้ ขยายได้ไม่เกิน 24 ชั่วโมงหลังเวลาปิดปกติ
              ระหว่างนี้ระบบยังไม่เปิดเฉลยและยังไม่คัดลอกโจทย์เข้าคลังย้อนหลัง
              ผู้เรียนที่ไม่ได้ตอบภายในเวลาที่ขยายจะถูกนับตามกติกาปกติ
              หากเลยเที่ยงคืนไปแล้วให้ใช้การรักษาหรือชดเชยแทน
            </p>
          </>
        ) : null}
        <input
          aria-label="เหตุผลชดเชย"
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผล"
        />
        <Button
          disabled={
            busy ||
            !from ||
            !to ||
            reason.trim().length < 3 ||
            (mode === "extend" && !until)
          }
          onClick={() =>
            void run(async () =>
              setPlan({
                ...(await api<Plan>("/admin/daily/outage/preview", {
                  method: "POST",
                  json: {
                    from,
                    to,
                    mode,
                    reason,
                    userIds: [],
                    ...(mode === "extend" ? { until: bangkokInstant(until) } : {}),
                  },
                })),
                kind: "outage",
              }),
            )
          }
        >
          แสดงจำนวนผู้ใช้ที่ได้รับผลกระทบ
        </Button>
      </Card>
        </div>
      </details>
      {plan && plan.kind !== "edit" ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-[19px] font-semibold">ตรวจผลกระทบก่อนยืนยัน</h2>
          <p>
            {plan.kind === "import"
                ? `นำเข้า ${plan.count} ชุดโจทย์`
                : plan.until
                  ? `ขยายเวลาให้${plan.everyone ? "ผู้เรียนทุกคน" : ` ${plan.affected} คน`} ถึง ${new Date(plan.until).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`
                  : `กระทบ ${plan.affected} คน`}
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const path =
                  plan.kind === "import"
                    ? "/admin/daily/import/commit"
                    : "/admin/daily/outage/commit";
                await api(path, {
                  method: "POST",
                  json: { previewId: plan.previewId },
                });
                await reload();
                setDraft(null);
              })
            }
          >
            ยืนยันรายการที่ตรวจแล้ว
          </Button>
          <Button kind="ghost" onClick={() => setPlan(null)}>
            ยกเลิก
          </Button>
        </Card>
      ) : null}
      {analytics ? (
        <Card className="flex flex-col gap-5">
          <h2 className="text-[19px] font-semibold">สรุปผลโจทย์ประจำวัน</h2>
          <p className="text-[14px] text-ink2">
            นับจากคำตอบทั้งหมดที่บันทึกไว้ ผู้เรียนหนึ่งคนถือว่าตอบถูกเมื่อถูกในครั้งใดครั้งหนึ่ง
            อัตราสำเร็จรายวันคือผู้ที่ได้ไฟเพิ่มเทียบกับผู้ที่ส่งคำตอบวันนั้น
          </p>
          {analytics.byDay.length === 0 ? (
            <p className="text-[15px] text-ink2">ยังไม่มีผู้ส่งคำตอบ</p>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-[16px] font-semibold">รายวัน</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr>
                        <th className="p-2">วัน</th>
                        <th>ผู้ส่งคำตอบ</th>
                        <th>ได้ไฟเพิ่ม</th>
                        <th>สำเร็จ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.byDay.map((d) => (
                        <tr key={d.date} className="border-t border-border">
                          <td className="p-2">{d.date}</td>
                          <td>{d.participants}</td>
                          <td>{d.increased}</td>
                          <td>{d.successPct === null ? "—" : `${d.successPct}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-[16px] font-semibold">รายข้อ</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[14px]">
                    <thead>
                      <tr>
                        <th className="p-2">วัน</th>
                        <th>โจทย์</th>
                        <th>หัวข้อ</th>
                        <th className="whitespace-nowrap pr-4">ผู้ตอบ</th>
                        <th className="whitespace-nowrap pr-4">ตอบถูก</th>
                        <th className="whitespace-nowrap pr-4">ถูกครั้งแรก</th>
                        <th className="whitespace-nowrap">เปิดคำใบ้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.byQuestion.map((q) => (
                        <tr
                          key={`${q.date}-${q.questionId}`}
                          className="border-t border-border align-top"
                        >
                          <td className="whitespace-nowrap p-2">{q.date}</td>
                          <td className="max-w-[320px] pr-3">
                            {q.prompt ?? q.questionId}
                          </td>
                          <td className="pr-3">{q.topic ?? "—"}</td>
                          <td className="pr-4">{q.users}</td>
                          <td className="whitespace-nowrap pr-4">
                            {q.correctUsers}
                            {q.successPct === null ? "" : ` (${q.successPct}%)`}
                          </td>
                          <td className="pr-4">{q.firstTryCorrect}</td>
                          <td>{q.hints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-[16px] font-semibold">
                  หัวข้อที่ตอบผิดบ่อย
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr>
                        <th className="p-2">วิชา</th>
                        <th>หัวข้อ</th>
                        <th>ผู้ตอบ</th>
                        <th>ยังตอบไม่ถูก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.weakTopics.map((t) => (
                        <tr
                          key={`${t.subject}-${t.topic}`}
                          className="border-t border-border"
                        >
                          <td className="p-2">
                            {SUBJECTS.find((s) => s.id === t.subject)?.label ??
                              t.subject}
                          </td>
                          <td className="pr-3">{t.topic || "—"}</td>
                          <td>{t.users}</td>
                          <td className="whitespace-nowrap">
                            {t.wrongUsers}
                            {t.wrongPct === null ? "" : ` (${t.wrongPct}%)`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </Card>
      ) : null}
      {analytics ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-[19px] font-semibold">ผลตอบรายคนและประวัติ Fire</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>วัน</th>
                  <th>ข้อ / ครั้ง</th>
                  <th>ผล</th>
                  <th>เห็นคำใบ้</th>
                </tr>
              </thead>
              <tbody>
                {analytics.responses.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">{r.userId}</td>
                    <td>{r.date}</td>
                    <td>
                      {r.questionId} / {r.tryNo}
                    </td>
                    <td>{r.correct ? "ถูก" : "ผิด"}</td>
                    <td>{r.hintShown ? "ใช่" : "ไม่ใช่"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Current / Highest</summary>
            {analytics.summaries.map((s) => (
              <p key={s.userId}>
                {s.userId}: {s.current} / {s.highest}
              </p>
            ))}
          </details>
          <details>
            <summary>รายการ Fire รายวัน</summary>
            {analytics.ledger.map((l, i) => (
              <p key={i}>
                {l.userId} · {l.date} · {l.state} · +{l.increment}
              </p>
            ))}
          </details>
          <details>
            <summary>ประวัติใช้สิทธิ์กู้ไฟ</summary>
            {analytics.recoveries.map((r, i) => (
              <p key={i}>
                {r.userId} · {r.missedDate} · เดือน {r.month}
              </p>
            ))}
          </details>
        </Card>
      ) : null}
    </>
  );
}

/** Search the exam bank and add a copy of a question to the daily set being edited. */
function BankPicker({ picked, onPick, onTopics }: { picked: Set<string>; onPick: (q: BankQuestion) => void; onTopics: (t: string[]) => void }) {
  const { api } = useAdmin();
  const [q, setQ] = useState(""),
    [subject, setSubject] = useState(""),
    [rows, setRows] = useState<BankQuestion[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ limit: "30" });
      if (q.trim()) params.set("q", q.trim());
      if (subject) params.set("subject", subject);
      api<{ questions: BankQuestion[]; total: number; topics: string[] }>(`/admin/daily/bank?${params}`)
        .then((r) => {
          setRows(r.questions);
          setTotal(r.total);
          onTopics(r.topics);
          setError("");
        })
        .catch((e) => setError(errorMessage(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [api, q, subject, onTopics]);
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-page p-4">
      <h3 className="font-medium">เลือกจากคลังข้อสอบ</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <input aria-label="ค้นหาโจทย์ในคลัง" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาจากข้อความโจทย์หรือหัวข้อ" />
        <select aria-label="วิชา" className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">ทุกวิชา</option>
          {SUBJECTS.map((x) => (
            <option key={x.id} value={x.id}>{x.label}</option>
          ))}
        </select>
      </div>
      {error ? <Note tone="error">{error}</Note> : null}
      <p className="text-[13.5px] text-ink3">พบ {total} ข้อ{total > rows.length ? ` · แสดง ${rows.length} ข้อล่าสุด พิมพ์ค้นหาเพื่อหาข้ออื่น` : ""}</p>
      <ul className="flex max-h-[420px] flex-col divide-y divide-border overflow-y-auto">
        {rows.map((b) => {
          const added = picked.has(b.id);
          return (
            <li key={b.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-ink3">
                  {SUBJECTS.find((x) => x.id === b.subject)?.label ?? b.subject} · {b.topic}
                  {b.imageUrls.length ? ` · มีรูป ${b.imageUrls.length}` : ""}
                </p>
                <p className="line-clamp-2 text-[15px]">{b.prompt}</p>
                {b.inPublishedPacks ? (
                  <p className="text-[13px] text-amber-ink">อยู่ในชุดข้อสอบที่เผยแพร่ {b.inPublishedPacks} ชุด — เฉลยจะเปิดให้ทุกคนเห็นหลังวันโจทย์</p>
                ) : null}
                {b.usedInDaily ? <p className="text-[13px] text-ink3">เคยใช้ในโจทย์ประจำวัน {b.usedInDaily} ครั้ง</p> : null}
              </div>
              <Button kind={added ? "ghost" : "primary"} disabled={added} onClick={() => onPick(b)}>
                {added ? "เพิ่มแล้ว" : "เพิ่มเข้าชุดนี้"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
