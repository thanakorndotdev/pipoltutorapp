"use client";

import { useId, useState, type FormEvent } from "react";

import { Button, Field, Note, inputClass } from "@/components/ui";
import { errorMessage } from "@/lib/admin";
import type { Product, ProductInput } from "@/lib/types";

export type ProductDraft = ProductInput & { slug: string; kind: Product["kind"] };

const KINDS: { value: Product["kind"]; label: string }[] = [
  { value: "exam_pack", label: "ชุดข้อสอบ" },
  { value: "course", label: "คอร์ส" },
  { value: "bundle", label: "แพ็กรวม (คอร์ส + ชุดข้อสอบ)" },
  { value: "fortune", label: "ดูดวง (หัวข้อ)" },
];

/** slug and kind are set once at creation; checkout links and unlock logic key off them. */
export function ProductForm({ initial, onSubmit, onCancel }: { initial: Product | null; onSubmit: (d: ProductDraft) => Promise<void>; onCancel: () => void }) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [kind, setKind] = useState<Product["kind"]>(initial?.kind ?? "fortune");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [baht, setBaht] = useState(initial ? String(initial.priceSatang / 100) : "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "");
  const [features, setFeatures] = useState((initial?.features ?? []).join("\n"));
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const s = slug.trim().toLowerCase();
    const n = Number(baht);
    if (!initial && !/^[a-z0-9-]+$/.test(s)) return setError("slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง");
    if (!title.trim()) return setError("กรอกชื่อสินค้า");
    if (!Number.isInteger(n) || n < 20 || n > 1_000_000) return setError("ใส่ราคาเป็นบาทเต็ม 20–1,000,000");
    const order = Number(sortOrder || 0);
    if (!Number.isInteger(order) || order < 0 || order > 9999) return setError("ลำดับเป็นเลขจำนวนเต็ม 0–9999");
    const lines = features.split("\n").map((f) => f.trim()).filter(Boolean);
    if (lines.length > 20) return setError("สิ่งที่ได้ไม่เกิน 20 บรรทัด");
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        slug: s,
        kind,
        title: title.trim(),
        description: description.trim() || null,
        priceSatang: n * 100,
        active,
        badge: badge.trim() || null,
        unit: unit.trim() || null,
        ctaLabel: ctaLabel.trim() || null,
        features: lines,
        featured,
        sortOrder: order,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-title`} label="ชื่อสินค้า">
        <input id={`${id}-title`} className={inputClass} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="ดูดวงการสอบ" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-kind`} label="ประเภท" hint={initial ? "เปลี่ยนไม่ได้หลังสร้าง" : undefined}>
          <select id={`${id}-kind`} className={inputClass} value={kind} disabled={!!initial} onChange={(e) => setKind(e.target.value as Product["kind"])}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-slug`} label="slug" hint={initial ? "เปลี่ยนไม่ได้หลังสร้าง" : "ใช้ในลิงก์ชำระเงิน เช่น fortune-love"}>
          <input id={`${id}-slug`} className={inputClass} value={slug} maxLength={80} disabled={!!initial} onChange={(e) => setSlug(e.target.value)} placeholder="fortune-love" />
        </Field>
      </div>
      <Field id={`${id}-desc`} label="รายละเอียด" hint={kind === "fortune" ? "ไม่บังคับ" : "แสดงใต้ชื่อบนการ์ดราคา · ไม่บังคับ"}>
        <textarea id={`${id}-desc`} className={`${inputClass} min-h-[88px] py-2.5`} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-price`} label="ราคา (บาท)" hint="บาทเต็ม ขั้นต่ำ 20 บาท">
          <input id={`${id}-price`} type="number" inputMode="numeric" min={20} step={1} className={`${inputClass} tabular`} value={baht} onChange={(e) => setBaht(e.target.value)} />
        </Field>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 self-end rounded-[12px] border border-border px-3.5 text-[15px]">
          <input type="checkbox" className="size-4 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} />
          เปิดขาย
        </label>
      </div>
      {kind !== "fortune" ? (
        <fieldset className="flex flex-col gap-4 rounded-[12px] border border-border p-3.5">
          <legend className="display px-1 text-[14px] font-medium">การ์ดราคา (หน้าแรก และหน้าคอร์สเรียน)</legend>
          <p className="text-[13px] text-ink3">สินค้าที่เปิดขายจะขึ้นการ์ดเอง เรียงตามลำดับจากน้อยไปมาก ปิดขายแล้วการ์ดจะหายไป</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id={`${id}-badge`} label="ป้ายบนการ์ด" hint="เช่น ยอดนิยม · เว้นว่างได้">
              <input id={`${id}-badge`} className={inputClass} value={badge} maxLength={40} onChange={(e) => setBadge(e.target.value)} />
            </Field>
            <Field id={`${id}-unit`} label="หน่วยราคา" hint="เช่น / คอร์ส">
              <input id={`${id}-unit`} className={inputClass} value={unit} maxLength={40} onChange={(e) => setUnit(e.target.value)} />
            </Field>
            <Field id={`${id}-cta`} label="ข้อความปุ่มสมัคร" hint="เว้นว่าง = สมัครเลย">
              <input id={`${id}-cta`} className={inputClass} value={ctaLabel} maxLength={60} onChange={(e) => setCtaLabel(e.target.value)} />
            </Field>
          </div>
          <Field id={`${id}-features`} label="สิ่งที่ได้" hint="บรรทัดละ 1 ข้อ">
            <textarea id={`${id}-features`} rows={5} className={`${inputClass} min-h-[120px] py-2.5 leading-[1.75]`} value={features} onChange={(e) => setFeatures(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${id}-order`} label="ลำดับการ์ด" hint="น้อยขึ้นก่อน">
              <input id={`${id}-order`} type="number" inputMode="numeric" min={0} max={9999} step={1} className={`${inputClass} tabular`} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </Field>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 self-end rounded-[12px] border border-border px-3.5 text-[15px]">
              <input type="checkbox" className="size-4 accent-brand" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              การ์ดเด่น (พื้นสีม่วง)
            </label>
          </div>
        </fieldset>
      ) : null}
      {error ? <Note tone="error">{error}</Note> : null}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button kind="ghost" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" icon="save" disabled={busy}>
          {busy ? "กำลังบันทึก…" : initial ? "บันทึก" : "เพิ่มสินค้า"}
        </Button>
      </div>
    </form>
  );
}
