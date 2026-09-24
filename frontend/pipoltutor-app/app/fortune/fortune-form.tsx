"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { Icon } from "@/components/ui";
import type { FortuneReading } from "@/lib/fortune";
import { PCSHS_CAMPUSES } from "@/lib/campuses";
import { formatBaht } from "@/lib/format";

export type FortuneTopic = { slug: string; title: string; priceSatang: number };

const SUGGEST = ["ควรอ่านวิชาไหนก่อนดี", "ช่วงไหนของวันสมองแล่นสุด", "ทำข้อสอบไม่ทันเวลาแก้ยังไง", "ควรพักตอนไหน"];
const MAX_Q = 200;

const fieldCls =
  "w-full min-h-[48px] rounded-[14px] border-[1.5px] border-white/25 bg-white/14 px-4 py-3 text-[16px] text-[#EFE8FF] placeholder:text-[#B9A8E8]";

function Field({ label, hint, children, id }: { label: string; hint?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-display text-[14.5px] font-medium text-white">{label}</label>
      {children}
      {hint ? <p className="text-[13px] text-[#B9A8E8]">{hint}</p> : null}
    </div>
  );
}

export function FortuneForm({ topics }: { topics: FortuneTopic[] }) {
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState(topics[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const ids = { name: useId(), dob: useId(), time: useId(), campus: useId(), q: useId() };

  /** POST the form as a reading; the backend prices it and returns the pending order for the pay step. */
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      dob: String(fd.get("dob") ?? ""),
      birthTime: String(fd.get("time") ?? "") || undefined,
      campus: String(fd.get("campus") ?? ""),
      question: question.trim(),
      productSlug: topic || undefined,
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fortune/readings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { reading?: FortuneReading; error?: string };
      if (!res.ok || !data.reading) throw new Error(data.error ?? "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      router.push(`/fortune/pay?reading=${encodeURIComponent(data.reading.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-4 rounded-[26px] border border-white/20 bg-white/10 p-[26px] lg:w-[520px] lg:shrink-0"
    >
      <Field label="ชื่อ-นามสกุล" id={ids.name}>
        <input id={ids.name} name="name" required maxLength={120} className={fieldCls} placeholder="เช่น ด.ญ. มิ้นท์ ใจดี" autoComplete="name" />
      </Field>
      <Field label="วัน เดือน ปีเกิด" id={ids.dob}>
        <input id={ids.dob} name="dob" type="date" required className={fieldCls} />
      </Field>
      <Field label="เวลาเกิดโดยประมาณ" id={ids.time} hint="ถ้าไม่แน่ใจ ใส่ช่วงเวลาที่ใกล้เคียงที่สุดได้">
        <input id={ids.time} name="time" type="time" className={fieldCls} />
      </Field>
      <Field label="สนามสอบที่ตั้งใจไว้" id={ids.campus}>
        <div className="relative">
          <select id={ids.campus} name="campus" required defaultValue="" className={`${fieldCls} appearance-none pr-11`}>
            <option value="" disabled>เลือกสนามสอบ</option>
            {PCSHS_CAMPUSES.map((c) => (
              <option key={c.code} value={c.code} className="text-ink">{c.label}</option>
            ))}
          </select>
          <Icon name="expand_more" size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#B9A8E8]" />
        </div>
      </Field>

      {topics.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-[14.5px] font-medium text-white">หัวข้อที่อยากดู</legend>
          {topics.map((t) => (
            <label
              key={t.slug}
              className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-white/25 bg-white/10 px-4 py-2.5 text-[15.5px] text-[#EFE8FF] has-[:checked]:border-[#FFC94D] has-[:checked]:bg-white/20"
            >
              <input type="radio" name="topic" value={t.slug} checked={topic === t.slug} onChange={() => setTopic(t.slug)} className="size-4 accent-[#FFC94D]" />
              <span className="flex-1">{t.title}</span>
              <span className="tabular font-display font-medium text-[#FFC94D]">{formatBaht(t.priceSatang)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor={ids.q} className="font-display text-[14.5px] font-medium text-white">คำถามที่อยากถาม</label>
          <span className="text-[13px] text-[#B9A8E8]">พิมพ์เองได้เลย</span>
        </div>
        <div className="rounded-[14px] border-[1.5px] border-white/25 bg-white/14 px-4 py-3.5">
          <textarea
            id={ids.q}
            name="question"
            rows={3}
            required
            maxLength={MAX_Q}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="หนูอ่านหนังสือทุกวันแต่คะแนนคณิตไม่ขึ้นเลย ควรเปลี่ยนวิธีอ่านยังไงดีคะ"
            className="w-full resize-none bg-transparent text-[16px] leading-[1.75] text-[#EFE8FF] outline-none placeholder:text-[#B9A8E8]"
          />
          <div className="mt-2 flex items-center justify-between text-[12.5px] text-[#B9A8E8]">
            <span className="flex items-center gap-1.5"><Icon name="edit_note" size={17} />ถามเป็นคำพูดของน้องเองได้เลย</span>
            <span className="tabular">{question.length} / {MAX_Q}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGEST.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuestion(s)}
              className="rounded-full border border-white/30 px-[13px] py-[7px] text-[13px] text-[#D9CCFF]"
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-[#B9A8E8]">กดตัวอย่างเพื่อเติมลงช่อง แล้วแก้เป็นคำถามของน้องเองได้</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-[14px] bg-white/14 px-4 py-3 text-[14.5px] text-[#FFD9D9]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#FFC94D] px-[26px] py-4 font-display text-[16px] font-medium text-[#3A1D8C] shadow-m disabled:opacity-60"
      >
        <Icon name="auto_awesome" size={20} fill />{busy ? "กำลังบันทึก…" : "ดูคำทำนาย"}
      </button>
      <p className="text-center text-[13px] text-[#B9A8E8]">ข้อมูลนี้ใช้เพื่อประมวลผลคำทำนายเท่านั้น ไม่ถูกเปิดเผยต่อบุคคลอื่น</p>
    </form>
  );
}
