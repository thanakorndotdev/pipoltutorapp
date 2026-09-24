"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { PCSHS_CAMPUSES, type PcshsCampusCode } from "@/lib/campuses";
import { PaymentStep } from "./payment-step";

type FormState = {
  studentName: string;
  currentSchool: string;
  targetCampus: PcshsCampusCode | "";
  studentInstagram: string;
  parentPhone: string;
  receiptEmail: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type CreatedOrder = {
  id: string;
  amountSatang: number;
  targetCampus: PcshsCampusCode;
  studentInstagram: string | null;
};

const INSTAGRAM_RE = /^[A-Za-z0-9._]{1,30}$/;
const PHONE_RE = /^0\d{9}$/;

function validate(f: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (!f.studentName.trim()) e.studentName = "กรอกชื่อ-นามสกุลนักเรียน";
  if (!f.currentSchool.trim()) e.currentSchool = "กรอกโรงเรียนปัจจุบัน";
  if (!f.targetCampus) e.targetCampus = "เลือก จภ. ที่ต้องการสอบเข้า";
  const ig = f.studentInstagram.trim().replace(/^@/, "");
  if (ig && !INSTAGRAM_RE.test(ig)) e.studentInstagram = "ใช้ได้เฉพาะ a-z, 0-9, จุด และขีดล่าง";
  if (!PHONE_RE.test(f.parentPhone.replace(/[\s-]/g, ""))) e.parentPhone = "เบอร์มือถือ 10 หลัก เช่น 0812345678";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.receiptEmail.trim())) e.receiptEmail = "อีเมลไม่ถูกต้อง";
  return e;
}

export function CheckoutForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    studentName: "",
    currentSchool: "",
    targetCampus: "",
    studentInstagram: "",
    parentPhone: "",
    receiptEmail: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedOrder | null>(null);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          studentName: form.studentName.trim(),
          currentSchool: form.currentSchool.trim(),
          targetCampus: form.targetCampus,
          studentInstagram: form.studentInstagram.trim(),
          parentPhone: form.parentPhone.trim(),
          receiptEmail: form.receiptEmail.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { order?: CreatedOrder; error?: string }
        | null;
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      if (!res.ok || !data?.order) {
        setSubmitError(data?.error ?? "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setCreated(data.order);
    } catch {
      setSubmitError("ติดต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const campus = PCSHS_CAMPUSES.find((c) => c.code === created.targetCampus)?.label;
    return (
      <section className="rounded-[18px] border border-border bg-card p-6 shadow-s" aria-live="polite">
        <h2 className="text-[19px] font-medium">บันทึกข้อมูลผู้เรียนแล้ว</h2>
        <p className="mt-2 text-[16px] text-ink2">
          สนามสอบที่ตั้งใจไว้: <span className="text-ink">{campus}</span>
          {created.studentInstagram ? (
            <>
              {" · "}Instagram: <span className="text-ink">@{created.studentInstagram}</span>
            </>
          ) : null}
        </p>
        <p className="mt-2 text-[14px] text-ink3">รหัสคำสั่งซื้อ {created.id}</p>
        <h2 className="mt-6 text-[19px] font-medium">ชำระเงิน</h2>
        <div className="mt-3">
          <PaymentStep orderId={created.id} amountSatang={created.amountSatang} />
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <section className="rounded-[18px] border border-border bg-card p-5 shadow-s md:p-6">
        <h2 className="text-[19px] font-medium">ข้อมูลผู้เรียน</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="ชื่อ-นามสกุลนักเรียน"
            value={form.studentName}
            onChange={set("studentName")}
            placeholder="ด.ญ. มิ้นท์ ใจดี"
            autoComplete="name"
            error={errors.studentName}
          />
          <TextField
            label="โรงเรียนปัจจุบัน"
            value={form.currentSchool}
            onChange={set("currentSchool")}
            placeholder="โรงเรียนสาธิตปทุมธานี"
            error={errors.currentSchool}
          />
          <SelectField
            label="จภ. ที่ต้องการสอบเข้า"
            value={form.targetCampus}
            onChange={set("targetCampus")}
            hint="เลือกได้ 1 แห่งจาก 18 แห่งทั่วประเทศ"
            error={errors.targetCampus}
          />
          <TextField
            label="Instagram นักเรียน"
            value={form.studentInstagram}
            onChange={(v) => set("studentInstagram")(v.replace(/^@+/, ""))}
            placeholder="mint.jaidee"
            prefix="@"
            hint="ไม่บังคับ · ใช้ติดต่อน้องโดยตรงและส่งข่าวรุ่น"
            autoComplete="off"
            autoCapitalize="none"
            error={errors.studentInstagram}
          />
          <TextField
            label="เบอร์ผู้ปกครอง"
            value={form.parentPhone}
            onChange={set("parentPhone")}
            placeholder="08x-xxx-xxxx"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={errors.parentPhone}
          />
          <TextField
            label="อีเมลรับใบเสร็จ"
            value={form.receiptEmail}
            onChange={set("receiptEmail")}
            placeholder="parent@example.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            error={errors.receiptEmail}
          />
        </div>
      </section>

      {submitError ? (
        <p role="alert" className="rounded-[16px] bg-accent-50 px-4 py-3.5 text-[15px] text-accent-dark">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-[52px] rounded-full bg-accent px-6 text-[17px] font-medium text-on-fill shadow-m disabled:opacity-60 md:self-end md:px-10"
      >
        {submitting ? "กำลังบันทึก…" : "ยืนยันข้อมูลและไปชำระเงิน"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full min-h-[48px] rounded-[14px] border-[1.5px] bg-page px-4 py-3 text-[16px] text-ink placeholder:text-ink3";

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="display text-[14.5px] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[14px] text-red">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[14px] text-ink3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  prefix,
  ...input
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  prefix?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        {prefix ? (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[16px] text-ink3">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${inputClass} ${error ? "border-red" : "border-border"} ${prefix ? "pl-9" : ""}`}
          {...input}
        />
      </div>
    </FieldShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: PcshsCampusCode | "";
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${inputClass} appearance-none pr-11 ${error ? "border-red" : "border-border"} ${
            value ? "" : "text-ink3"
          }`}
        >
          <option value="" disabled>
            เลือกสนามสอบ
          </option>
          {PCSHS_CAMPUSES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-ink3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </FieldShell>
  );
}
