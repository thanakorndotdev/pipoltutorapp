"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { Icon } from "@/components/ui";
import { PCSHS_CAMPUSES, type PcshsCampusCode } from "@/lib/campuses";

export type ProfileValues = {
  firstName: string;
  lastName: string;
  nickname: string;
  campus: PcshsCampusCode | "";
};

type Errors = Partial<Record<keyof ProfileValues, string>>;

const inputClass =
  "w-full min-h-[48px] rounded-[14px] border-[1.5px] bg-page px-4 py-3 text-[16px] text-ink placeholder:text-ink3";

function validate(v: ProfileValues): Errors {
  const e: Errors = {};
  if (!v.firstName.trim()) e.firstName = "กรอกชื่อจริง";
  if (!v.lastName.trim()) e.lastName = "กรอกนามสกุล";
  if (!v.nickname.trim()) e.nickname = "กรอกชื่อเล่น";
  if (!v.campus) e.campus = "เลือก จภ. ที่สมัคร";
  return e;
}

/**
 * Student profile: first fill after Google login, and edits later. Saves to
 * PUT /api/profile, then goes to `next`. Past attempts keep the details they
 * were taken under; an edit only affects attempts started afterwards.
 */
export function ProfileForm({ initial, email, next, first }: { initial: ProfileValues; email: string; next: string; first: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = useId();

  const set = (key: keyof ProfileValues) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    setSaved(false);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          nickname: values.nickname.trim(),
          campus: values.campus,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
      if (first) {
        router.push(next);
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const field = (key: "firstName" | "lastName" | "nickname", label: string, placeholder: string, autoComplete: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-${key}`} className="display text-[14.5px] font-medium">{label}</label>
      <input
        id={`${id}-${key}`}
        value={values[key]}
        onChange={(e) => set(key)(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={key === "nickname" ? 40 : 80}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        className={`${inputClass} ${errors[key] ? "border-red" : "border-border"}`}
      />
      {errors[key] ? <p id={`${id}-${key}-error`} className="text-[14px] text-red">{errors[key]}</p> : null}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {field("firstName", "ชื่อจริง", "มิ้นท์", "given-name")}
        {field("lastName", "นามสกุล", "ใจดี", "family-name")}
        {field("nickname", "ชื่อเล่น", "มิ้นท์", "nickname")}
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-campus`} className="display text-[14.5px] font-medium">โรงเรียน จภ. ที่สมัคร</label>
          <div className="relative">
            <select
              id={`${id}-campus`}
              value={values.campus}
              onChange={(e) => set("campus")(e.target.value)}
              aria-invalid={errors.campus ? true : undefined}
              aria-describedby={errors.campus ? `${id}-campus-error` : undefined}
              className={`${inputClass} appearance-none pr-11 ${errors.campus ? "border-red" : "border-border"} ${values.campus ? "" : "text-ink3"}`}
            >
              <option value="" disabled>เลือก จภ. (18 แห่ง)</option>
              {PCSHS_CAMPUSES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <Icon name="expand_more" size={22} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink3" />
          </div>
          {errors.campus ? <p id={`${id}-campus-error`} className="text-[14px] text-red">{errors.campus}</p> : null}
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <span className="display text-[14.5px] font-medium">อีเมล</span>
          <p className="flex min-h-[48px] items-center gap-2 rounded-[14px] bg-page px-4 text-[16px] text-ink2">
            <Icon name="mail" size={19} className="text-ink3" />
            <span className="min-w-0 truncate">{email}</span>
          </p>
          <p className="text-[14px] text-ink3">ใช้อีเมลจากบัญชี Google ที่เข้าสู่ระบบ เปลี่ยนที่นี่ไม่ได้</p>
        </div>
      </div>

      {submitError ? (
        <p role="alert" className="rounded-[16px] bg-red-50 px-4 py-3.5 text-[15px] text-red">{submitError}</p>
      ) : null}
      {saved ? (
        <p role="status" className="flex items-center gap-2 rounded-[16px] bg-green-50 px-4 py-3.5 text-[15px] text-green">
          <Icon name="check_circle" size={19} fill />บันทึกข้อมูลแล้ว
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="min-h-[52px] rounded-full bg-brand px-6 font-display text-[17px] font-medium text-on-fill shadow-m disabled:opacity-60 md:self-end md:px-10"
      >
        {saving ? "กำลังบันทึก…" : first ? "บันทึกและไปต่อ" : "บันทึกการแก้ไข"}
      </button>
    </form>
  );
}
