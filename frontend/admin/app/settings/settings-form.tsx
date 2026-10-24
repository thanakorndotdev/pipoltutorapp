"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { Button, Card, Field, Note, PageHeader, Spinner, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDate, toDay } from "@/lib/format";
import type { ExamSettings } from "@/lib/types";

const BANGKOK = "+07:00";

type FormState = {
  examDate: string;
  examVenueLabel: string;
  enrollCloseAt: string;
  urgentDays: string;
};
type Errors = Partial<Record<keyof FormState, string>>;

function toForm(s: ExamSettings): FormState {
  return {
    examDate: toDay(s.examDate),
    examVenueLabel: s.examVenueLabel,
    enrollCloseAt: toDay(s.enrollCloseAt),
    urgentDays: String(s.urgentDays),
  };
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.examDate) e.examDate = "เลือกวันสอบ";
  if (!f.enrollCloseAt) e.enrollCloseAt = "เลือกวันปิดรับสมัคร";
  if (f.examDate && f.enrollCloseAt && f.enrollCloseAt > f.examDate) e.enrollCloseAt = "วันปิดรับสมัครต้องไม่เกินวันสอบ";
  if (!f.examVenueLabel.trim()) e.examVenueLabel = "กรอกชื่อสนามสอบ";
  const urgent = Number(f.urgentDays);
  if (!Number.isInteger(urgent) || urgent < 0 || urgent > 365) e.urgentDays = "ใส่จำนวนวัน 0–365";
  return e;
}

function statusLabel(s: ExamSettings): string {
  if (s.status === "passed") return "ถึงวันสอบแล้ว — หน้าแรกแสดง “รอประกาศรอบถัดไป”";
  if (s.status === "urgent") return `เหลือ ${s.daysLeft} วัน — ตัวนับเป็นสีส้ม`;
  return `เหลือ ${s.daysLeft} วัน`;
}

export function SettingsForm() {
  const { api } = useAdmin();
  const [current, setCurrent] = useState<ExamSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ids = { examDate: useId(), enrollCloseAt: useId(), venue: useId(), urgent: useId() };

  useEffect(() => {
    let cancelled = false;
    api<ExamSettings>("/settings/exam")
      .then((s) => {
        if (cancelled) return;
        setCurrent(s);
        setForm(toForm(s));
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api]);

  const set = (k: keyof FormState) => (v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
    setSaved(false);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError(null);
    try {
      const s = await api<ExamSettings>("/settings/exam", {
        method: "PUT",
        json: {
          examDate: `${form.examDate}T00:00:00${BANGKOK}`,
          enrollCloseAt: `${form.enrollCloseAt}T23:59:59${BANGKOK}`,
          examVenueLabel: form.examVenueLabel.trim(),
          urgentDays: Number(form.urgentDays),
        },
      });
      setCurrent(s);
      setForm(toForm(s));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="วันสอบ" sub="ใช้กับตัวนับถอยหลังหน้าแรก เวลาทำข้อสอบตั้งในแต่ละชุด" />
      {error && !form ? <Note tone="error">{error}</Note> : null}
      {!form && !error ? <Spinner /> : null}
      {current ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-[16px] font-semibold">ค่าที่ใช้อยู่</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-2">
            <Row k="วันสอบ" v={`${current.examVenueLabel} · ${formatThaiDate(current.examDate)}`} />
            <Row k="ปิดรับสมัคร" v={formatThaiDate(current.enrollCloseAt)} />
            <Row k="สถานะนับถอยหลัง" v={statusLabel(current)} />
          </dl>
        </Card>
      ) : null}
      {form ? (
        <form onSubmit={onSubmit} noValidate className="flex max-w-[760px] flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold">วันสอบและการรับสมัคร</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id={ids.examDate} label="วันสอบ" error={errors.examDate} hint="นับถอยหลังถึงเที่ยงคืนของวันนี้ (เวลาไทย)">
                <input id={ids.examDate} type="date" className={inputClass} value={form.examDate} onChange={(e) => set("examDate")(e.target.value)} />
              </Field>
              <Field id={ids.enrollCloseAt} label="วันปิดรับสมัครคอร์ส" error={errors.enrollCloseAt} hint="สิ้นสุด 23:59 ของวันที่เลือก">
                <input id={ids.enrollCloseAt} type="date" className={inputClass} value={form.enrollCloseAt} onChange={(e) => set("enrollCloseAt")(e.target.value)} />
              </Field>
              <Field id={ids.venue} label="ชื่อสนามสอบ" error={errors.examVenueLabel}>
                <input id={ids.venue} className={inputClass} maxLength={40} value={form.examVenueLabel} onChange={(e) => set("examVenueLabel")(e.target.value)} />
              </Field>
              <Field id={ids.urgent} label="เตือนสีส้มเมื่อเหลือไม่เกิน (วัน)" error={errors.urgentDays}>
                <input id={ids.urgent} type="number" inputMode="numeric" min={0} max={365} className={inputClass} value={form.urgentDays} onChange={(e) => set("urgentDays")(e.target.value)} />
              </Field>
            </div>
          </Card>
          {error ? <Note tone="error">{error}</Note> : null}
          {saved ? <Note tone="ok">บันทึกแล้ว หน้าแรกของนักเรียนจะแสดงค่าใหม่ทันที</Note> : null}
          <div className="flex justify-end">
            <Button type="submit" icon="save" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink3">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
