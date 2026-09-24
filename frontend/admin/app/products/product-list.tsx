"use client";

import { useEffect, useState } from "react";

import { Button, Card, Empty, Modal, Note, PageHeader, Spinner, Tag } from "@/components/ui";
import { ProductForm, type ProductDraft } from "@/components/product-form";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatBaht } from "@/lib/format";
import type { Product } from "@/lib/types";

const KIND_LABEL: Record<Product["kind"], string> = {
  exam_pack: "ชุดข้อสอบ",
  course: "คอร์ส",
  bundle: "แพ็กรวม",
  fortune: "ดูดวง",
};

export function ProductList() {
  const { api } = useAdmin();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    api<{ products: Product[] }>("/admin/products")
      .then((r) => {
        if (cancelled) return;
        setProducts(r.products);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, tick]);

  async function save(d: ProductDraft) {
    const { slug, kind, ...fields } = d;
    if (editing === "new") await api("/admin/products", { method: "POST", json: { slug, kind, ...fields } });
    else if (editing) await api(`/admin/products/${editing.id}`, { method: "PUT", json: fields });
    setEditing(null);
    reload();
  }

  async function remove(p: Product) {
    if (confirmId !== p.id) {
      setConfirmId(p.id);
      return;
    }
    setConfirmId(null);
    try {
      await api(`/admin/products/${p.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="สินค้าและราคา"
        sub="ราคาที่แสดงบนเว็บและราคาที่เรียกเก็บตอนชำระเงิน"
        actions={
          <Button icon="add" onClick={() => setEditing("new")}>
            เพิ่มสินค้า
          </Button>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {!products && !error ? <Spinner /> : null}
      {products && products.length === 0 ? <Empty>ยังไม่มีสินค้า</Empty> : null}
      {products && products.length > 0 ? (
        <div className="flex max-w-[860px] flex-col gap-3">
          <Note>ราคาใหม่ใช้กับคำสั่งซื้อที่สร้างหลังบันทึก คำสั่งซื้อที่รอชำระอยู่ยังใช้ราคาเดิม · สินค้าดูดวงที่เปิดขาย = หัวข้อให้เลือกในหน้าดูดวง</Note>
          {products.map((p) => (
            <Card key={p.id} className={`flex flex-col gap-3 sm:flex-row sm:items-center ${p.active ? "" : "opacity-70"}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={p.kind === "fortune" ? "mystic" : "brand"}>{KIND_LABEL[p.kind]}</Tag>
                  {p.active ? <Tag tone="green">เปิดขาย</Tag> : <Tag tone="red">ปิดขาย</Tag>}
                </div>
                <p className="text-[15.5px] font-medium">{p.title}</p>
                {p.description ? <p className="text-[13.5px] text-ink2">{p.description}</p> : null}
                <p className="text-[13px] text-ink3">{p.slug}</p>
              </div>
              <p className="tabular font-display text-[20px] font-semibold sm:w-[140px] sm:text-right">{formatBaht(p.priceSatang)}</p>
              <div className="flex flex-wrap gap-2 sm:flex-col">
                <Button size="sm" icon="edit" onClick={() => setEditing(p)}>
                  แก้ไข
                </Button>
                {confirmId === p.id ? (
                  <Button kind="ghost" size="sm" onClick={() => setConfirmId(null)}>
                    ยกเลิก
                  </Button>
                ) : null}
                <Button kind="danger" size="sm" icon="delete" onClick={() => remove(p)}>
                  {confirmId === p.id ? "ยืนยันลบ" : "ลบ"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {editing !== null ? (
        <Modal title={editing === "new" ? "เพิ่มสินค้า" : "แก้ไขสินค้า"} onClose={() => setEditing(null)}>
          <ProductForm initial={editing === "new" ? null : editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      ) : null}
    </>
  );
}
