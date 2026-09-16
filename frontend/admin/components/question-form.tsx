"use client";

import { useId, useState, type FormEvent } from "react";

import { ImagePicker } from "@/components/image-picker";
import { Button, Field, Note, inputClass } from "@/components/ui";
import { errorMessage } from "@/lib/admin";
import { SUBJECTS, type Choice, type Question, type QuestionInput, type Subject } from "@/lib/types";

const DEFAULT_KEYS = ["ก", "ข", "ค", "ง"];

type Draft = {
  subject: Subject;
  topic: string;
  prompt: string;
  imageUrl: string;
  choices: Choice[];
  correctChoice: string;
  explanation: string;
  active: boolean;
};

function fromQuestion(q: Question | null): Draft {
  return q
    ? { subject: q.subject, topic: q.topic, prompt: q.prompt, imageUrl: q.imageUrl ?? "", choices: q.choices.map((c) => ({ ...c })), correctChoice: q.correctChoice, explanation: q.explanation ?? "", active: q.active }
    : { subject: "math", topic: "", prompt: "", imageUrl: "", choices: DEFAULT_KEYS.map((key) => ({ key, text: "" })), correctChoice: "ก", explanation: "", active: true };
}

function validate(d: Draft): string | null {
  if (!d.topic.trim()) return "กรอกบทเรียน/หัวข้อ";
  if (!d.prompt.trim()) return "กรอกโจทย์";
  if (d.choices.length < 2) return "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ";
  if (d.choices.some((c) => !c.key.trim() || !c.text.trim())) return "ตัวเลือกทุกข้อต้องมีตัวอักษรและข้อความ";
  const keys = d.choices.map((c) => c.key.trim());
  if (new Set(keys).size !== keys.length) return "ตัวอักษรของตัวเลือกซ้ำกัน";
  if (!keys.includes(d.correctChoice)) return "เลือกเฉลยให้ตรงกับตัวเลือก";
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

  const patch = (p: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...p }));
    setError(null);
  };
  const setChoice = (i: number, p: Partial<Choice>) =>
    patch({ choices: d.choices.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validate(d);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        subject: d.subject,
        topic: d.topic.trim(),
        prompt: d.prompt.trim(),
        imageUrl: d.imageUrl.trim() || null,
        choices: d.choices.map((c) => ({ key: c.key.trim(), text: c.text.trim() })),
        correctChoice: d.correctChoice,
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
      <Field id={`${id}-prompt`} label="โจทย์">
        <textarea id={`${id}-prompt`} rows={3} className={`${inputClass} leading-[1.75]`} value={d.prompt} maxLength={4000} onChange={(e) => patch({ prompt: e.target.value })} />
      </Field>
      <Field id={`${id}-image`} label="รูปประกอบ (ถ้ามี)" hint="อัปโหลดจากเครื่อง (PNG, JPEG, WebP, GIF ไม่เกิน 5 MB) หรือวางลิงก์รูป">
        <ImagePicker id={`${id}-image`} value={d.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} onError={setError} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="display mb-1 text-[14px] font-medium">ตัวเลือกและเฉลย</legend>
        {d.choices.map((c, i) => {
          const correct = d.correctChoice === c.key;
          return (
            <div key={i} className={`flex items-center gap-2 rounded-[12px] border-[1.5px] p-1.5 ${correct ? "border-green bg-green-50" : "border-border"}`}>
              <input
                type="radio"
                name={`${id}-correct`}
                aria-label={`เฉลยคือ ${c.key}`}
                checked={correct}
                onChange={() => patch({ correctChoice: c.key })}
                className="ml-1.5 size-5 accent-green"
              />
              <input aria-label="ตัวอักษร" className={`${inputClass} w-[56px]! shrink-0 min-h-[38px] px-2 text-center`} value={c.key} maxLength={4} onChange={(e) => setChoice(i, { key: e.target.value })} />
              <input aria-label={`ข้อความตัวเลือก ${c.key}`} className={`${inputClass} min-h-[38px]`} value={c.text} maxLength={2000} onChange={(e) => setChoice(i, { text: e.target.value })} />
              <Button kind="subtle" size="sm" icon="close" title="ลบตัวเลือก" disabled={d.choices.length <= 2} onClick={() => patch({ choices: d.choices.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
        {d.choices.length < 6 ? (
          <Button kind="ghost" size="sm" icon="add" className="self-start" onClick={() => patch({ choices: [...d.choices, { key: DEFAULT_KEYS[d.choices.length] ?? "", text: "" }] })}>
            เพิ่มตัวเลือก
          </Button>
        ) : null}
      </fieldset>

      <Field id={`${id}-exp`} label="เฉลยละเอียด (แสดงหลังส่งข้อสอบ)">
        <textarea id={`${id}-exp`} rows={2} className={`${inputClass} leading-[1.75]`} value={d.explanation} maxLength={4000} onChange={(e) => patch({ explanation: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-[14.5px]">
        <input type="checkbox" className="size-5 accent-brand" checked={d.active} onChange={(e) => patch({ active: e.target.checked })} />
        เปิดใช้งาน (เลือกเข้าชุดข้อสอบได้)
      </label>

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
