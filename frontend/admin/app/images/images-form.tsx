"use client";

import { useCallback, useEffect, useState } from "react";

import { ImagePicker } from "@/components/image-picker";
import { Button, Card, Field, Note, PageHeader, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateTime } from "@/lib/format";
import type { SiteAssetSlot } from "@/lib/types";

const GROUPS: { id: SiteAssetSlot["group"]; label: string }[] = [
  { id: "brand", label: "แบรนด์" },
  { id: "landing", label: "หน้าแรก" },
  { id: "about", label: "หน้ารู้จักพี่ที" },
  { id: "courses", label: "หน้าคอร์ส" },
];

type Draft = { imageUrl: string; alt: string };

function draftOf(s: SiteAssetSlot): Draft {
  return { imageUrl: s.asset?.imageUrl ?? "", alt: s.asset?.alt ?? "" };
}

export function ImagesForm() {
  const { api } = useAdmin();
  const [slots, setSlots] = useState<SiteAssetSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ slots: SiteAssetSlot[] }>("/admin/site/assets")
      .then((r) => {
        setSlots(r.slots);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [api]);

  useEffect(load, [load]);

  const replace = (slot: SiteAssetSlot) => setSlots((prev) => prev?.map((s) => (s.key === slot.key ? slot : s)) ?? prev);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="รูปภาพเว็บไซต์" sub="โลโก้ favicon และรูปในหน้าต่าง ๆ ของเว็บ — ช่องที่ยังไม่ใส่รูปจะแสดงกรอบ placeholder ตามเดิม" />
      {error ? <Note tone="error">{error}</Note> : null}
      {!slots ? (
        <Spinner />
      ) : (
        GROUPS.map((g) => {
          const items = slots.filter((s) => s.group === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id} className="flex flex-col gap-3">
              <h2 className="text-[19px] font-semibold">{g.label}</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {items.map((s) => (
                  <SlotCard key={s.key} slot={s} onSaved={replace} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function SlotCard({ slot, onSaved }: { slot: SiteAssetSlot; onSaved: (slot: SiteAssetSlot) => void }) {
  const { api } = useAdmin();
  const [d, setD] = useState<Draft>(() => draftOf(slot));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dirty = d.imageUrl.trim() !== (slot.asset?.imageUrl ?? "") || d.alt.trim() !== (slot.asset?.alt ?? "");

  async function save() {
    const imageUrl = d.imageUrl.trim();
    setBusy(true);
    setError(null);
    try {
      if (!imageUrl) {
        await api(`/admin/site/assets/${slot.key}`, { method: "DELETE" });
        onSaved({ ...slot, asset: null });
      } else {
        const r = await api<{ asset: NonNullable<SiteAssetSlot["asset"]> }>(`/admin/site/assets/${slot.key}`, {
          method: "PUT",
          json: { imageUrl, alt: d.alt.trim() },
        });
        onSaved({ ...slot, asset: r.asset });
      }
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-medium">{slot.label}</h3>
        {slot.asset ? <Tag tone="green">ใช้รูปที่ตั้งไว้</Tag> : <Tag>ยังใช้ placeholder</Tag>}
      </div>
      <p className="text-[13.5px] text-ink3">{slot.hint}</p>
      <ImagePicker id={`asset-${slot.key}`} value={d.imageUrl} onChange={(imageUrl) => setD((p) => ({ ...p, imageUrl }))} onError={setError} ratio={slot.ratio} previewClass="max-h-48" />
      <Field id={`alt-${slot.key}`} label="คำอธิบายรูป (alt)" hint="สำหรับผู้ใช้ screen reader และตอนรูปโหลดไม่ขึ้น เว้นว่างได้ถ้าเป็นรูปตกแต่ง">
        <input id={`alt-${slot.key}`} className={inputClass} value={d.alt} maxLength={300} onChange={(e) => setD((p) => ({ ...p, alt: e.target.value }))} />
      </Field>
      {error ? <Note tone="error">{error}</Note> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button icon="save" disabled={busy || !dirty} onClick={save}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        {dirty ? (
          <Button kind="subtle" disabled={busy} onClick={() => setD(draftOf(slot))}>
            ยกเลิก
          </Button>
        ) : null}
        <span className="ml-auto text-[12.5px] text-ink3">
          {savedAt ? `บันทึกแล้ว ${formatThaiDateTime(savedAt)}` : slot.asset ? `แก้ล่าสุด ${formatThaiDateTime(slot.asset.updatedAt)}` : ""}
        </span>
      </div>
    </Card>
  );
}
