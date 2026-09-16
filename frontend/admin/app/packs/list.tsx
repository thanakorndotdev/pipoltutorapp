"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PackForm } from "@/components/pack-form";
import { Button, Card, Empty, Modal, Note, PageHeader, Spinner, Tag } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatClock } from "@/lib/format";
import type { ExamSettings, Pack, PackInput, Product } from "@/lib/types";

export function PackList() {
  const { api } = useAdmin();
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [multiplier, setMultiplier] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Pack | null | "new">(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<{ packs: Pack[] }>("/admin/packs"), api<Product[]>("/products"), api<ExamSettings>("/settings/exam")])
      .then(([p, prod, s]) => {
        if (cancelled) return;
        setPacks(p.packs);
        setProducts(prod.filter((x) => x.active && x.kind !== "fortune"));
        setMultiplier(s.timeMultiplierPercent);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, tick]);

  async function save(input: PackInput) {
    if (editing === "new") await api("/admin/packs", { method: "POST", json: input });
    else if (editing) await api(`/admin/packs/${editing.id}`, { method: "PUT", json: input });
    setEditing(null);
    reload();
  }

  async function remove(p: Pack) {
    if (confirmId !== p.id) {
      setConfirmId(p.id);
      return;
    }
    setConfirmId(null);
    try {
      await api(`/admin/packs/${p.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="ชุดข้อสอบ"
        sub="แต่ละชุดประกอบจากคลังข้อสอบ กด “เลือกข้อสอบ” เพื่อจัดข้อเข้าชุดและเรียงลำดับ"
        actions={
          <Button icon="add" onClick={() => setEditing("new")}>
            สร้างชุดใหม่
          </Button>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {packs === null && !error ? <Spinner /> : null}
      {packs && packs.length === 0 ? <Empty icon="inventory_2">ยังไม่มีชุดข้อสอบ สร้างชุดแรกได้เลย</Empty> : null}
      {packs && packs.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {packs.map((p) => {
            const full = p.assigned >= p.questionCount;
            return (
              <li key={p.id}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[17px] font-semibold">{p.title}</h2>
                      <p className="text-[13px] text-ink3">{p.slug}</p>
                    </div>
                    <Tag tone={full ? "green" : p.assigned === 0 ? "red" : "amber"}>
                      {p.assigned} / {p.questionCount} ข้อ
                    </Tag>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-page">
                    <div className={`h-full rounded-full ${full ? "bg-green" : "bg-accent"}`} style={{ width: `${Math.min(100, (p.assigned / p.questionCount) * 100)}%` }} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[14px]">
                    <dt className="text-ink3">เวลาที่ตั้งไว้</dt>
                    <dd className="tabular">{Math.round(p.durationSeconds / 60)} นาที</dd>
                    <dt className="text-ink3">นักเรียนได้ ({multiplier}%)</dt>
                    <dd className="tabular">{formatClock(Math.round((p.durationSeconds * multiplier) / 100))}</dd>
                    <dt className="text-ink3">ปลดล็อกด้วย</dt>
                    <dd>{p.productTitle ?? "ชุดฟรี"}</dd>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                    <Link href={`/packs/edit/?id=${p.id}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] bg-brand px-3 text-[14px] font-medium text-on-fill hover:bg-brand-dark">
                      <span className="sym" style={{ fontSize: 17 }} aria-hidden>
                        checklist
                      </span>
                      เลือกข้อสอบ
                    </Link>
                    <Button kind="ghost" size="sm" icon="edit" onClick={() => setEditing(p)}>
                      แก้ไขชุด
                    </Button>
                    {confirmId === p.id ? (
                      <Button kind="ghost" size="sm" className="ml-auto" onClick={() => setConfirmId(null)}>
                        ยกเลิก
                      </Button>
                    ) : null}
                    <Button kind="danger" size="sm" icon="delete" className={confirmId === p.id ? "" : "ml-auto"} onClick={() => remove(p)}>
                      {confirmId === p.id ? "ยืนยันลบ" : "ลบ"}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
      {editing !== null ? (
        <Modal title={editing === "new" ? "สร้างชุดข้อสอบ" : "แก้ไขชุดข้อสอบ"} onClose={() => setEditing(null)}>
          <PackForm initial={editing === "new" ? null : editing} products={products} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      ) : null}
    </>
  );
}
