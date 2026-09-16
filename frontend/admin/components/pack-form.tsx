"use client";

import { useId, useState, type FormEvent } from "react";

import { Button, Field, Note, inputClass } from "@/components/ui";
import { errorMessage } from "@/lib/admin";
import type { Pack, PackInput, Product } from "@/lib/types";

type Draft = { slug: string; title: string; productId: string; questionCount: string; durationMinutes: string };

function fromPack(p: Pack | null): Draft {
  return p
    ? { slug: p.slug, title: p.title, productId: p.productId ?? "", questionCount: String(p.questionCount), durationMinutes: String(Math.round(p.durationSeconds / 60)) }
    : { slug: "", title: "", productId: "", questionCount: "100", durationMinutes: "90" };
}

export function PackForm({ initial, products, onSubmit, onCancel }: { initial: Pack | null; products: Product[]; onSubmit: (input: PackInput) => Promise<void>; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(() => fromPack(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const patch = (p: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...p }));
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const slug = d.slug.trim().toLowerCase();
    const count = Number(d.questionCount);
    const minutes = Number(d.durationMinutes);
    if (!/^[a-z0-9-]+$/.test(slug)) return setError("slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง");
    if (!d.title.trim()) return setError("กรอกชื่อชุด");
    if (!Number.isInteger(count) || count < 1 || count > 500) return setError("จำนวนข้อ 1–500");
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 360) return setError("เวลา 1–360 นาที");
    setBusy(true);
    try {
      await onSubmit({ slug, title: d.title.trim(), productId: d.productId || null, questionCount: count, durationSeconds: minutes * 60 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-title`} label="ชื่อชุด">
        <input id={`${id}-title`} className={inputClass} value={d.title} maxLength={160} onChange={(e) => patch({ title: e.target.value })} placeholder="ข้อสอบเสมือนจริง ชุดที่ 2" />
      </Field>
      <Field id={`${id}-slug`} label="slug" hint="ใช้ใน URL เช่น mock-2">
        <input id={`${id}-slug`} className={inputClass} value={d.slug} maxLength={80} onChange={(e) => patch({ slug: e.target.value })} placeholder="mock-2" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-count`} label="จำนวนข้อเป้าหมาย">
          <input id={`${id}-count`} type="number" inputMode="numeric" min={1} max={500} className={inputClass} value={d.questionCount} onChange={(e) => patch({ questionCount: e.target.value })} />
        </Field>
        <Field id={`${id}-min`} label="เวลาที่ตั้งไว้ (นาที)" hint="นักเรียนได้เวลานี้ × ตัวคูณในหน้า “วันสอบและเวลา”">
          <input id={`${id}-min`} type="number" inputMode="numeric" min={1} max={360} className={inputClass} value={d.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value })} />
        </Field>
      </div>
      <Field id={`${id}-product`} label="สินค้าที่ปลดล็อกชุดนี้" hint="ว่าง = ชุดฟรี ทำได้โดยไม่ต้องซื้อ">
        <select id={`${id}-product`} className={inputClass} value={d.productId} onChange={(e) => patch({ productId: e.target.value })}>
          <option value="">— ชุดฟรี —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>
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
