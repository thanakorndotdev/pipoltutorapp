"use client";

import { useId, useState, type FormEvent } from "react";

import { ImagePicker } from "@/components/image-picker";
import { Button, Field, Note, inputClass } from "@/components/ui";
import { errorMessage } from "@/lib/admin";
import {
  QUESTION_TYPES,
  SUBJECTS,
  type Choice,
  type Question,
  type QuestionInput,
  type QuestionType,
  type ScoringMode,
  type Subject,
} from "@/lib/types";

const DEFAULT_KEYS = ["ก", "ข", "ค", "ง", "จ", "ฉ", "ช", "ซ", "ฌ", "ญ"];
const MAX_CHOICES = 10;

type Draft = {
  subject: Subject;
  topic: string;
  prompt: string;
  /** One entry per figure; blank entries are dropped on save. */
  imageUrls: string[];
  /** Links shown as named links under the figures; blank entries are dropped on save. */
  linkUrls: string[];
  type: QuestionType;
  points: string;
  scoring: ScoringMode;
  choices: Choice[];
  correctChoices: string[];
  /** Kept exactly as typed: short answers are matched character for character. */
  acceptedAnswers: string[];
  explanation: string;
  active: boolean;
};

function fromQuestion(q: Question | null): Draft {
  return q
    ? {
        subject: q.subject,
        topic: q.topic,
        prompt: q.prompt,
        imageUrls: [...q.imageUrls],
        linkUrls: [...q.linkUrls],
        type: q.type,
        points: String(q.points),
        scoring: q.scoring,
        choices: q.choices.length ? q.choices.map((c) => ({ ...c })) : DEFAULT_KEYS.slice(0, 4).map((key) => ({ key, text: "" })),
        correctChoices: [...q.correctChoices],
        acceptedAnswers: q.acceptedAnswers.length ? [...q.acceptedAnswers] : [""],
        explanation: q.explanation ?? "",
        active: q.active,
      }
    : {
        subject: "math",
        topic: "",
        prompt: "",
        imageUrls: [],
        linkUrls: [],
        type: "single",
        points: "1",
        scoring: "exact",
        choices: DEFAULT_KEYS.slice(0, 4).map((key) => ({ key, text: "" })),
        correctChoices: ["ก"],
        acceptedAnswers: [""],
        explanation: "",
        active: true,
      };
}

function validate(d: Draft): string | null {
  if (!d.topic.trim()) return "กรอกบทเรียน/หัวข้อ";
  if (!d.prompt.trim()) return "กรอกโจทย์";
  const pts = Number(d.points);
  if (!Number.isFinite(pts) || pts < 0 || pts > 1000) return "คะแนน 0–1000 (ทศนิยมได้ เช่น 1.5)";
  if (d.type === "short") {
    if (!d.acceptedAnswers.some((a) => a !== "")) return "ใส่คำตอบที่ยอมรับอย่างน้อย 1 แบบ";
    return null;
  }
  if (d.choices.length < 2) return "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ";
  if (d.choices.some((c) => !c.key.trim() || !c.text.trim())) return "ตัวเลือกทุกข้อต้องมีตัวอักษรและข้อความ";
  const keys = d.choices.map((c) => c.key.trim());
  if (new Set(keys).size !== keys.length) return "ตัวอักษรของตัวเลือกซ้ำกัน";
  const correct = d.correctChoices.filter((k) => keys.includes(k));
  if (correct.length === 0) return "เลือกเฉลยให้ตรงกับตัวเลือก";
  if (d.type === "single" && correct.length !== 1) return "ข้อปรนัยมีเฉลยได้ 1 ตัวเลือก";
  return null;
}

/** Create/edit form; the parent owns the API call so it can update its list. */
export function QuestionForm({
  initial,
  topics,
  onSubmit,
  onCancel,
}: {
  initial: Question | null;
  topics: string[];
  onSubmit: (input: QuestionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => fromQuestion(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const listId = `${id}-topics`;
  const answered = initial !== null && (initial.usedInPacks ?? 0) > 0;

  const patch = (p: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...p }));
    setError(null);
  };
  const setChoice = (i: number, p: Partial<Choice>) => {
    const old = d.choices[i]!.key;
    const choices = d.choices.map((c, j) => (j === i ? { ...c, ...p } : c));
    // Renaming a key carries its "correct" mark with it.
    const correctChoices = p.key !== undefined ? d.correctChoices.map((k) => (k === old ? p.key! : k)) : d.correctChoices;
    patch({ choices, correctChoices });
  };
  const toggleCorrect = (key: string) => {
    if (d.type === "single") return patch({ correctChoices: [key] });
    patch({ correctChoices: d.correctChoices.includes(key) ? d.correctChoices.filter((k) => k !== key) : [...d.correctChoices, key] });
  };
  const moveImage = (i: number, by: -1 | 1) => {
    const imageUrls = [...d.imageUrls];
    [imageUrls[i], imageUrls[i + by]] = [imageUrls[i + by]!, imageUrls[i]!];
    patch({ imageUrls });
  };
  const changeType = (type: QuestionType) => {
    // Going to radio keeps only the first correct key.
    patch({ type, correctChoices: type === "single" ? d.correctChoices.slice(0, 1) : d.correctChoices });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validate(d);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const short = d.type === "short";
      const keys = d.choices.map((c) => c.key.trim());
      await onSubmit({
        subject: d.subject,
        topic: d.topic.trim(),
        prompt: d.prompt.trim(),
        imageUrls: d.imageUrls.map((u) => u.trim()).filter(Boolean),
        linkUrls: d.linkUrls.map((u) => u.trim()).filter(Boolean),
        type: d.type,
        points: Math.round(Number(d.points) * 100) / 100,
        scoring: d.type === "multiple" ? d.scoring : "exact",
        choices: short ? [] : d.choices.map((c) => ({ key: c.key.trim(), text: c.text.trim() })),
        correctChoices: short ? [] : d.correctChoices.filter((k) => keys.includes(k)),
        acceptedAnswers: short ? Array.from(new Set(d.acceptedAnswers.filter((a) => a !== ""))) : [],
        explanation: d.explanation.trim() || null,
        active: d.active,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-subject`} label="วิชา">
          <select id={`${id}-subject`} className={inputClass} value={d.subject} onChange={(e) => patch({ subject: e.target.value as Subject })}>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-topic`} label="บทเรียน / หัวข้อ" hint="พิมพ์ใหม่หรือเลือกจากที่มีอยู่">
          <input id={`${id}-topic`} className={inputClass} list={listId} value={d.topic} maxLength={120} onChange={(e) => patch({ topic: e.target.value })} />
          <datalist id={listId}>
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
        <Field id={`${id}-type`} label="ประเภทคำถาม" hint={answered ? "ถ้ามีนักเรียนตอบข้อนี้แล้ว จะเปลี่ยนประเภทไม่ได้" : undefined}>
          <select id={`${id}-type`} className={inputClass} value={d.type} onChange={(e) => changeType(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-points`} label="คะแนนข้อนี้" hint="ทศนิยมได้ เช่น 1.5">
          <input id={`${id}-points`} type="number" inputMode="decimal" min={0} max={1000} step="0.01" className={inputClass} value={d.points} onChange={(e) => patch({ points: e.target.value })} />
        </Field>
      </div>

      <Field id={`${id}-prompt`} label="โจทย์">
        <textarea id={`${id}-prompt`} rows={3} className={`${inputClass} leading-[1.75]`} value={d.prompt} maxLength={4000} onChange={(e) => patch({ prompt: e.target.value })} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="display mb-1 text-[14px] font-medium">รูปประกอบ (ถ้ามี)</legend>
        <p className="text-[13px] text-ink3">ใส่ได้หลายรูป แสดงใต้โจทย์ตามลำดับนี้ อัปโหลดจากเครื่อง (PNG, JPEG, WebP, GIF ไม่เกิน 5 MB) หรือวางลิงก์รูป</p>
        {d.imageUrls.map((url, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-[12px] border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium">รูปที่ {i + 1}</span>
              <div className="ml-auto flex gap-1">
                <Button kind="subtle" size="sm" icon="arrow_upward" title={`เลื่อนรูปที่ ${i + 1} ขึ้น`} disabled={i === 0} onClick={() => moveImage(i, -1)} />
                <Button
                  kind="subtle"
                  size="sm"
                  icon="arrow_downward"
                  title={`เลื่อนรูปที่ ${i + 1} ลง`}
                  disabled={i === d.imageUrls.length - 1}
                  onClick={() => moveImage(i, 1)}
                />
                <Button kind="subtle" size="sm" icon="delete" title={`ลบรูปที่ ${i + 1}`} onClick={() => patch({ imageUrls: d.imageUrls.filter((_, j) => j !== i) })} />
              </div>
            </div>
            <ImagePicker
              id={`${id}-image-${i}`}
              value={url}
              onChange={(next) => patch({ imageUrls: d.imageUrls.map((u, j) => (j === i ? next : u)) })}
              onError={setError}
            />
          </div>
        ))}
        <div>
          <Button kind="ghost" size="sm" icon="add_photo_alternate" onClick={() => patch({ imageUrls: [...d.imageUrls, ""] })}>
            เพิ่มรูป
          </Button>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="display mb-1 text-[14px] font-medium">ลิงก์ประกอบ (ถ้ามี)</legend>
        <p className="text-[13px] text-ink3">
          ใช้กับลิงก์ที่ไม่ใช่ไฟล์รูป เช่น Google Drive หรือหน้าเว็บ นักเรียนจะเห็นเป็นลิงก์ชื่อ "ลิงก์ประกอบโจทย์ข้อ … ลิงก์ที่ …" ใต้รูป กดแล้วเปิดแท็บใหม่ (ขึ้นต้นด้วย http:// หรือ https://)
        </p>
        {d.linkUrls.map((url, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={`ลิงก์ที่ ${i + 1}`}
              type="url"
              inputMode="url"
              placeholder="https://drive.google.com/…"
              className={inputClass}
              value={url}
              maxLength={2000}
              onChange={(e) => patch({ linkUrls: d.linkUrls.map((u, j) => (j === i ? e.target.value : u)) })}
            />
            <Button kind="subtle" size="sm" icon="delete" title={`ลบลิงก์ที่ ${i + 1}`} onClick={() => patch({ linkUrls: d.linkUrls.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <div>
          <Button kind="ghost" size="sm" icon="add_link" onClick={() => patch({ linkUrls: [...d.linkUrls, ""] })}>
            เพิ่มลิงก์
          </Button>
        </div>
      </fieldset>

      {d.type === "short" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="display mb-1 text-[14px] font-medium">คำตอบที่ยอมรับ</legend>
          <p className="text-[13px] text-ink3">
            ตรวจแบบตรงทุกตัวอักษร ตัวพิมพ์เล็ก–ใหญ่ ช่องว่าง และรูปแบบตัวเลขมีผล (0.5 กับ 0.50 ไม่เหมือนกัน) ใส่ทุกแบบที่ให้ถือว่าถูก
          </p>
          {d.acceptedAnswers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={`คำตอบที่ยอมรับแบบที่ ${i + 1}`}
                className={`${inputClass} min-h-[40px]`}
                value={a}
                maxLength={500}
                spellCheck={false}
                onChange={(e) => patch({ acceptedAnswers: d.acceptedAnswers.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <Button kind="subtle" size="sm" icon="close" title="ลบคำตอบนี้" disabled={d.acceptedAnswers.length <= 1} onClick={() => patch({ acceptedAnswers: d.acceptedAnswers.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {d.acceptedAnswers.length < 20 ? (
            <Button kind="ghost" size="sm" icon="add" className="self-start" onClick={() => patch({ acceptedAnswers: [...d.acceptedAnswers, ""] })}>
              เพิ่มคำตอบอีกแบบ
            </Button>
          ) : null}
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="display mb-1 text-[14px] font-medium">ตัวเลือกและเฉลย</legend>
          <p className="text-[13px] text-ink3">
            {d.type === "single" ? "เลือกเฉลย 1 ตัวเลือก" : "ติ๊กทุกตัวเลือกที่ถูก"}
          </p>
          {d.choices.map((c, i) => {
            const correct = d.correctChoices.includes(c.key);
            return (
              <div key={i} className={`flex items-center gap-2 rounded-[12px] border-[1.5px] p-1.5 ${correct ? "border-green bg-green-50" : "border-border"}`}>
                <input
                  type={d.type === "single" ? "radio" : "checkbox"}
                  name={`${id}-correct`}
                  aria-label={`${c.key} เป็นคำตอบที่ถูก`}
                  checked={correct}
                  onChange={() => toggleCorrect(c.key)}
                  className="ml-1.5 size-5 accent-green"
                />
                <input aria-label="ตัวอักษร" className={`${inputClass} w-[56px]! shrink-0 min-h-[38px] px-2 text-center`} value={c.key} maxLength={4} onChange={(e) => setChoice(i, { key: e.target.value })} />
                <input aria-label={`ข้อความตัวเลือก ${c.key}`} className={`${inputClass} min-h-[38px]`} value={c.text} maxLength={2000} onChange={(e) => setChoice(i, { text: e.target.value })} />
                <Button
                  kind="subtle"
                  size="sm"
                  icon="close"
                  title="ลบตัวเลือก"
                  disabled={d.choices.length <= 2}
                  onClick={() => patch({ choices: d.choices.filter((_, j) => j !== i), correctChoices: d.correctChoices.filter((k) => k !== c.key) })}
                />
              </div>
            );
          })}
          {d.choices.length < MAX_CHOICES ? (
            <Button kind="ghost" size="sm" icon="add" className="self-start" onClick={() => patch({ choices: [...d.choices, { key: DEFAULT_KEYS[d.choices.length] ?? "", text: "" }] })}>
              เพิ่มตัวเลือก
            </Button>
          ) : null}
          {d.type === "multiple" ? (
            <div className="mt-1 flex flex-col gap-2 rounded-[12px] bg-page p-3">
              <p className="text-[14px] font-medium">วิธีให้คะแนน</p>
              <label className="flex items-start gap-2 text-[14px]">
                <input type="radio" name={`${id}-scoring`} className="mt-1 size-4 accent-brand" checked={d.scoring === "exact"} onChange={() => patch({ scoring: "exact" })} />
                <span>ตรงเป๊ะ — ได้คะแนนเต็มเมื่อเลือกถูกครบทุกตัวและไม่เกิน ขาดหรือเกินแม้ 1 ตัว = 0</span>
              </label>
              <label className="flex items-start gap-2 text-[14px]">
                <input type="radio" name={`${id}-scoring`} className="mt-1 size-4 accent-brand" checked={d.scoring === "partial"} onChange={() => patch({ scoring: "partial" })} />
                <span>ให้คะแนนบางส่วน — คะแนน × (ข้อที่เลือกถูก − ข้อที่เลือกผิด) ÷ จำนวนเฉลย ต่ำสุด 0</span>
              </label>
            </div>
          ) : null}
        </fieldset>
      )}

      <Field id={`${id}-exp`} label="เฉลยละเอียด (แสดงหลังส่ง เฉพาะชุดที่เปิดให้ดูเฉลย)">
        <textarea id={`${id}-exp`} rows={2} className={`${inputClass} leading-[1.75]`} value={d.explanation} maxLength={4000} onChange={(e) => patch({ explanation: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-[14.5px]">
        <input type="checkbox" className="size-5 accent-brand" checked={d.active} onChange={(e) => patch({ active: e.target.checked })} />
        เปิดใช้งาน (เลือกเข้าชุดข้อสอบได้)
      </label>
      {answered ? (
        <Note tone="warn">
          ข้อนี้อยู่ในชุดข้อสอบแล้ว แก้เฉลยหรือคะแนนแล้ว คนที่ส่งไปแล้วยังได้คะแนนเดิมจนกว่าจะกด “ตรวจใหม่” ที่หน้าผลสอบของชุดนั้น
        </Note>
      ) : null}

      {error ? <Note tone="error">{error}</Note> : null}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button kind="ghost" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" icon="save" disabled={busy}>
          {busy ? "กำลังบันทึก…" : initial ? "บันทึกการแก้ไข" : "เพิ่มข้อสอบ"}
        </Button>
      </div>
    </form>
  );
}
