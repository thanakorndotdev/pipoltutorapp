"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { Button, Field, Note, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { fromBangkokLocal, toBangkokLocal } from "@/lib/format";
import type { CertPackSettings, CertTemplate, Pack, PackInput } from "@/lib/types";

type Draft = CertPackSettings & {
  slug: string;
  title: string;
  description: string;
  questionCount: string;
  durationMinutes: string;
  /** "1", "unlimited" or "custom" (then `maxAttempts`). */
  attemptMode: "1" | "unlimited" | "custom";
  maxAttempts: string;
  opensAt: string;
  closesAt: string;
  published: boolean;
  showReview: boolean;
  paperUrl: string;
};

function fromPack(p: Pack | null): Draft {
  if (!p) {
    return {
      slug: "",
      title: "",
      description: "",
      questionCount: "100",
      durationMinutes: "90",
      attemptMode: "1",
      maxAttempts: "3",
      opensAt: "",
      closesAt: "",
      published: false,
      showReview: false,
      paperUrl: "",
      level: null,
      subjectLabel: null,
      certificateEnabled: false,
      certOnAutoSubmit: true,
      certOnHardCutoff: true,
      certOnReopen: false,
      certTemplateId: null,
    };
  }
  return {
    slug: p.slug,
    title: p.title,
    description: p.description ?? "",
    questionCount: String(p.questionCount),
    durationMinutes: String(Math.round(p.durationSeconds / 60)),
    attemptMode: p.maxAttempts === null ? "unlimited" : p.maxAttempts === 1 ? "1" : "custom",
    maxAttempts: String(p.maxAttempts ?? 3),
    opensAt: p.opensAt ? toBangkokLocal(p.opensAt) : "",
    closesAt: p.closesAt ? toBangkokLocal(p.closesAt) : "",
    published: p.published,
    showReview: p.showReview,
    paperUrl: p.paperUrl ?? "",
    level: p.level,
    subjectLabel: p.subjectLabel,
    certificateEnabled: p.certificateEnabled,
    certOnAutoSubmit: p.certOnAutoSubmit,
    certOnHardCutoff: p.certOnHardCutoff,
    certOnReopen: p.certOnReopen,
    certTemplateId: p.certTemplateId,
  };
}

/** Exams are free; a pack is just its settings plus the questions picked in the editor. */
export function PackForm({ initial, onSubmit, onCancel }: { initial: Pack | null; onSubmit: (input: PackInput) => Promise<void>; onCancel: () => void }) {
  const { api } = useAdmin();
  const [templates, setTemplates] = useState<CertTemplate[] | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(() => fromPack(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => {
    let cancelled = false;
    api<{ templates: CertTemplate[] }>("/admin/cert-templates")
      .then((r) => !cancelled && setTemplates(r.templates))
      .catch((e) => !cancelled && setTemplateError(errorMessage(e)));
    return () => { cancelled = true; };
  }, [api]);
  const patch = (p: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...p }));
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const slug = d.slug.trim().toLowerCase();
    const count = Number(d.questionCount);
    const minutes = Number(d.durationMinutes);
    const custom = Number(d.maxAttempts);
    if (!/^[a-z0-9-]+$/.test(slug)) return setError("slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง");
    if (!d.title.trim()) return setError("กรอกชื่อชุด");
    if (!Number.isInteger(count) || count < 1 || count > 500) return setError("จำนวนข้อ 1–500");
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 360) return setError("เวลา 1–360 นาที");
    if (d.attemptMode === "custom" && (!Number.isInteger(custom) || custom < 1 || custom > 100)) return setError("จำนวนครั้ง 1–100");
    if (d.opensAt && d.closesAt && d.closesAt <= d.opensAt) return setError("เวลาปิดรับต้องหลังเวลาเปิดสอบ");
    const paperUrl = d.paperUrl.trim();
    if (paperUrl && !paperUrl.startsWith("https://")) return setError("ลิงก์ PDF ต้องขึ้นต้นด้วย https://");
    setBusy(true);
    try {
      await onSubmit({
        slug,
        title: d.title.trim(),
        description: d.description.trim() || null,
        questionCount: count,
        durationSeconds: minutes * 60,
        maxAttempts: d.attemptMode === "unlimited" ? null : d.attemptMode === "1" ? 1 : custom,
        opensAt: fromBangkokLocal(d.opensAt),
        closesAt: fromBangkokLocal(d.closesAt),
        published: d.published,
        showReview: d.showReview,
        paperUrl: paperUrl || null,
        level: d.level,
        subjectLabel: d.subjectLabel?.trim() || null,
        certificateEnabled: d.certificateEnabled,
        certOnAutoSubmit: d.certOnAutoSubmit,
        certOnHardCutoff: d.certOnHardCutoff,
        certOnReopen: d.certOnReopen,
        certTemplateId: d.certTemplateId,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-title`} label="ชื่อชุด">
        <input id={`${id}-title`} className={inputClass} value={d.title} maxLength={160} onChange={(e) => patch({ title: e.target.value })} placeholder="Mock Test Day ครั้งที่ 1" />
      </Field>
      <Field id={`${id}-slug`} label="slug" hint="ใช้ใน URL เช่น pipoltutor.org/exam/mock-day-1">
        <input id={`${id}-slug`} className={inputClass} value={d.slug} maxLength={80} onChange={(e) => patch({ slug: e.target.value })} placeholder="mock-day-1" />
      </Field>
      <Field id={`${id}-desc`} label="คำชี้แจง" hint="นักเรียนเห็นก่อนกดเริ่ม (ยังไม่จับเวลา) — จำนวนข้อ ตอน คะแนน และเวลา ระบบแสดงให้อัตโนมัติ">
        <textarea id={`${id}-desc`} rows={4} className={`${inputClass} leading-[1.75]`} value={d.description} maxLength={8000} onChange={(e) => patch({ description: e.target.value })} />
      </Field>
      <Field id={`${id}-paper`} label="ลิงก์ข้อสอบ PDF (ไม่บังคับ)" hint="เช่น ลิงก์ Google Drive ที่ตั้งเป็น “ทุกคนที่มีลิงก์ดูได้” — นักเรียนเห็นปุ่มเปิด PDF หลังกดเริ่มทำเท่านั้น">
        <input id={`${id}-paper`} type="url" inputMode="url" className={inputClass} value={d.paperUrl} maxLength={2000} onChange={(e) => patch({ paperUrl: e.target.value })} placeholder="https://drive.google.com/file/d/…/view" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-count`} label="จำนวนข้อเป้าหมาย">
          <input id={`${id}-count`} type="number" inputMode="numeric" min={1} max={500} className={inputClass} value={d.questionCount} onChange={(e) => patch({ questionCount: e.target.value })} />
        </Field>
        <Field id={`${id}-min`} label="เวลาทำข้อสอบ (นาที)" hint="นักเรียนได้เวลานี้พอดี เริ่มนับเมื่อกดเริ่มทำ">
          <input id={`${id}-min`} type="number" inputMode="numeric" min={1} max={360} className={inputClass} value={d.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value })} />
        </Field>
        <Field id={`${id}-open`} label="เปิดสอบ (เวลาไทย)" hint="เว้นว่าง = เปิดทันที">
          <input id={`${id}-open`} type="datetime-local" className={inputClass} value={d.opensAt} onChange={(e) => patch({ opensAt: e.target.value })} />
        </Field>
        <Field id={`${id}-close`} label="ปิดรับคำตอบ (เวลาไทย)" hint="ถึงเวลานี้ระบบส่งให้ทุกคนทันที เว้นว่าง = เปิดตลอด">
          <input id={`${id}-close`} type="datetime-local" className={inputClass} value={d.closesAt} onChange={(e) => patch({ closesAt: e.target.value })} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[14px] font-medium">จำนวนครั้งที่ทำได้ต่อนักเรียน</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["1", "1 ครั้ง"],
              ["unlimited", "ไม่จำกัด"],
              ["custom", "กำหนดเอง"],
            ] as const
          ).map(([mode, label]) => (
            <label key={mode} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-[12px] border border-border px-3 text-[14px] has-[:checked]:border-brand has-[:checked]:bg-brand/5">
              <input type="radio" name={`${id}-attempts`} className="size-4 accent-brand" checked={d.attemptMode === mode} onChange={() => patch({ attemptMode: mode })} />
              {label}
            </label>
          ))}
          {d.attemptMode === "custom" ? (
            <input
              aria-label="จำนวนครั้ง"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              className={`${inputClass} w-[100px]! min-h-[40px]`}
              value={d.maxAttempts}
              onChange={(e) => patch({ maxAttempts: e.target.value })}
            />
          ) : null}
        </div>
        <p className="text-[13px] text-ink3">รีเซ็ตสิทธิ์รายคนได้ที่หน้า “ผลสอบ” — ประวัติครั้งเดิมยังเก็บไว้</p>
      </fieldset>
      <label className="flex items-start gap-2 text-[14.5px]">
        <input type="checkbox" className="mt-0.5 size-5 accent-brand" checked={d.published} onChange={(e) => patch({ published: e.target.checked })} />
        <span>เผยแพร่ — นักเรียนเห็นชุดนี้ที่หน้า /exam (ปิดไว้ = ซ่อน ทีมงานยังเปิดทดสอบได้ ประวัติไม่หาย)</span>
      </label>
      <label className="flex items-start gap-2 text-[14.5px]">
        <input type="checkbox" className="mt-0.5 size-5 accent-brand" checked={d.showReview} onChange={(e) => patch({ showReview: e.target.checked })} />
        <span>ให้นักเรียนดูผลรายข้อและเฉลยหลังส่ง (ปิดไว้ = เห็นเฉพาะคะแนนรวมเบื้องต้น)</span>
      </label>
      <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
        <legend className="text-[16px] font-semibold">เกียรติบัตรของชุดข้อสอบ</legend>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[14.5px]">
          <input type="checkbox" className="size-5 accent-brand" checked={d.certificateEnabled} onChange={(e) => patch({ certificateEnabled: e.target.checked })} />
          ออกเกียรติบัตรให้ผู้ที่ส่งข้อสอบ
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${id}-level`} label="ระดับชั้นของข้อสอบ">
            <select id={`${id}-level`} className={inputClass} value={d.level ?? ""} onChange={(e) => patch({ level: (e.target.value || null) as Draft["level"] })}>
              <option value="">ไม่ระบุ</option>
              <option value="m1">ม.1</option>
              <option value="m4">ม.4</option>
            </select>
          </Field>
          <Field id={`${id}-subject`} label="วิชา (พิมพ์บนเกียรติบัตร)">
            <input id={`${id}-subject`} className={inputClass} maxLength={120} value={d.subjectLabel ?? ""} onChange={(e) => patch({ subjectLabel: e.target.value || null })} placeholder="คณิตศาสตร์" />
          </Field>
        </div>
        {d.certificateEnabled ? (
          <>
            {([
              ["certOnAutoSubmit", "หมดเวลาทำข้อสอบ ระบบส่งให้อัตโนมัติ"],
              ["certOnHardCutoff", "ถูกตัดที่เวลาปิดรับของชุด (Hard cutoff)"],
              ["certOnReopen", "การสอบที่ถูกรีเซ็ตสิทธิ์ให้สอบใหม่"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[14.5px]">
                <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={d[key]} onChange={(e) => patch({ [key]: e.target.checked })} />
                {label}
              </label>
            ))}
            <Field id={`${id}-template`} label="เทมเพลตเกียรติบัตร" hint="เปลี่ยนแล้วใช้กับใบที่ออกใหม่ จัดการใบเดิมได้ที่หน้าเกียรติบัตร">
              <select id={`${id}-template`} className={inputClass} disabled={!templates} value={d.certTemplateId ?? ""} onChange={(e) => patch({ certTemplateId: e.target.value || null })}>
                <option value="">แบบมาตรฐานของเว็บ</option>
                {!templates && d.certTemplateId ? <option value={d.certTemplateId}>เทมเพลตปัจจุบัน</option> : null}
                {templates?.map((t) => <option key={t.id} value={t.id} disabled={t.publishedVersion === 0}>{t.name} {t.publishedVersion ? `· v${t.publishedVersion}` : "(ยังไม่เผยแพร่)"}</option>)}
              </select>
            </Field>
            {templateError ? <Note tone="warn">โหลดเทมเพลตไม่ได้: {templateError} · การบันทึกจะคงเทมเพลตที่เลือกไว้</Note> : null}
          </>
        ) : null}
        <p className="text-[14px] leading-[1.7] text-ink2">การเปลี่ยนสิทธิ์จะออกใบให้การสอบที่เข้าเงื่อนไข และเพิกถอนใบที่ไม่เข้าเงื่อนไขอัตโนมัติ</p>
      </fieldset>
      {error ? <Note tone="error">{error}</Note> : null}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button kind="ghost" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" icon="save" disabled={busy}>
          {busy ? "กำลังบันทึก…" : initial ? "บันทึก" : "สร้างชุด"}
        </Button>
      </div>
    </form>
  );
}
