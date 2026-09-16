"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card, Note, PageHeader, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateTime } from "@/lib/format";
import type { SiteTextSlot } from "@/lib/types";

const GROUPS: { id: SiteTextSlot["group"]; label: string }[] = [
  { id: "brand", label: "แบรนด์" },
  { id: "home", label: "หน้าแรก" },
  { id: "about", label: "หน้ารู้จักพี่ที" },
  { id: "courses", label: "หน้าคอร์ส" },
  { id: "footer", label: "ท้ายเว็บ" },
];

export function TextsForm() {
  const { api } = useAdmin();
  const [slots, setSlots] = useState<SiteTextSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<SiteTextSlot["group"]>("home");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    api<{ slots: SiteTextSlot[] }>("/admin/site/texts")
      .then((r) => {
        setSlots(r.slots);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [api]);
  useEffect(load, [load]);

  const replace = (slot: SiteTextSlot) => setSlots((prev) => prev?.map((s) => (s.key === slot.key ? slot : s)) ?? prev);

  const visible = useMemo(() => {
    if (!slots) return [];
    const needle = q.trim().toLowerCase();
    return slots.filter((s) => {
      if (!needle) return s.group === group;
      const hay = `${s.label} ${s.default} ${s.override?.value ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [slots, group, q]);

  const overridden = slots?.filter((s) => s.override).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="ข้อความเว็บไซต์" sub={`แก้หัวข้อ คำโปรย ปุ่ม และรายการต่าง ๆ บนเว็บ — ${overridden} รายการถูกแก้จากค่าเริ่มต้น`} />
      {error ? <Note tone="error">{error}</Note> : null}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGroup(g.id);
                setQ("");
              }}
              className={`rounded-full border px-3.5 py-1.5 text-[14px] ${group === g.id && !q ? "border-brand bg-brand-50 text-brand" : "border-border text-ink2 hover:bg-page"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <input className={inputClass} placeholder="ค้นหาข้อความ (ค้นทุกหน้า)" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>
      {!slots ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Note>ไม่พบข้อความที่ตรงกับคำค้น</Note>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((s) => (
            <TextCard key={s.key} slot={s} onSaved={replace} />
          ))}
        </div>
      )}
    </div>
  );
}

function TextCard({ slot, onSaved }: { slot: SiteTextSlot; onSaved: (slot: SiteTextSlot) => void }) {
  const { api } = useAdmin();
  const current = slot.override?.value ?? slot.default;
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== current;
  const rows = slot.kind === "text" ? 1 : Math.min(12, Math.max(3, value.split("\n").length + 1));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (value === slot.default) {
        await api(`/admin/site/texts/${slot.key}`, { method: "DELETE" });
        onSaved({ ...slot, override: null });
      } else {
        const r = await api<{ override: NonNullable<SiteTextSlot["override"]> }>(`/admin/site/texts/${slot.key}`, { method: "PUT", json: { value } });
        onSaved({ ...slot, override: r.override });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/site/texts/${slot.key}`, { method: "DELETE" });
      onSaved({ ...slot, override: null });
      setValue(slot.default);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`t-${slot.key}`} className="display text-[15px] font-medium">
          {slot.label}
        </label>
        {slot.override ? <Tag tone="brand">แก้แล้ว</Tag> : <Tag>ค่าเริ่มต้น</Tag>}
        <code className="ml-auto text-[11.5px] text-ink3">{slot.key}</code>
      </div>
      {slot.hint ? <p className="text-[13.5px] text-ink3">{slot.hint}</p> : null}
      {slot.kind === "text" ? (
        <input id={`t-${slot.key}`} className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
      ) : (
        <textarea id={`t-${slot.key}`} rows={rows} className={`${inputClass} leading-[1.7]`} value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      {error ? <Note tone="error">{error}</Note> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button icon="save" size="sm" disabled={busy || !dirty} onClick={save}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        {dirty ? (
          <Button kind="subtle" size="sm" disabled={busy} onClick={() => setValue(current)}>
            ยกเลิก
          </Button>
        ) : null}
        {slot.override ? (
          <Button kind="ghost" size="sm" icon="restart_alt" disabled={busy} onClick={reset}>
            คืนค่าเริ่มต้น
          </Button>
        ) : null}
        <span className="ml-auto text-[12.5px] text-ink3">{slot.override ? `แก้ล่าสุด ${formatThaiDateTime(slot.override.updatedAt)}` : ""}</span>
      </div>
    </Card>
  );
}
