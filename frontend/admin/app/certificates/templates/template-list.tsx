"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card, Empty, Field, Icon, Note, PageHeader, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateTime } from "@/lib/format";
import type { CertTemplate } from "@/lib/types";

const linkBtn = "inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-medium";

export function TemplateList() {
  const { api } = useAdmin();
  const router = useRouter();
  const [templates, setTemplates] = useState<CertTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ templates: CertTemplate[] }>("/admin/cert-templates")
      .then((r) => {
        if (cancelled) return;
        setTemplates(r.templates);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, tick]);

  async function create(fromId?: string, baseName?: string) {
    try {
      const r = await api<{ template: CertTemplate }>("/admin/cert-templates", { method: "POST", json: { name: (baseName ? `${baseName} (สำเนา)` : name).trim(), ...(fromId ? { fromId } : {}) } });
      router.push(`/certificates/templates/edit/?id=${r.template.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove(t: CertTemplate) {
    if (confirmId !== t.id) return setConfirmId(t.id);
    setConfirmId(null);
    try {
      await api(`/admin/cert-templates/${t.id}`, { method: "DELETE" });
      setTick((x) => x + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="เทมเพลตเกียรติบัตร"
        sub="ออกแบบหน้าตาเกียรติบัตร แล้วเลือกใช้กับชุดข้อสอบในหน้า “เกียรติบัตร” — ชุดที่ไม่เลือกเทมเพลตใช้แบบมาตรฐานของเว็บ"
        actions={
          <Link href="/certificates/" className={`${linkBtn} min-h-[44px] border-[1.5px] border-border-strong bg-card px-4 text-[15px] text-ink hover:bg-page`}>
            <Icon name="arrow_back" size={19} />
            เกียรติบัตร
          </Link>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      <Card className="flex max-w-[640px] flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field id="tpl-name" label="สร้างเทมเพลตใหม่" hint="เริ่มจากแบบมาตรฐาน แล้วแก้ต่อได้">
            <input id="tpl-name" className={inputClass} maxLength={120} placeholder="เช่น Pre-test ม.1 ปี 2570" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Button icon="add" disabled={!name.trim()} onClick={() => void create()}>
          สร้าง
        </Button>
      </Card>
      {!templates && !error ? <Spinner /> : null}
      {templates?.length === 0 ? <Empty icon="design_services">ยังไม่มีเทมเพลต</Empty> : null}
      <ul className="flex max-w-[920px] flex-col gap-3">
        {templates?.map((t) => (
          <li key={t.id}>
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-medium">{t.name}</p>
                  {t.publishedVersion > 0 ? <Tag tone="green">เผยแพร่ v{t.publishedVersion}</Tag> : <Tag tone="amber">ฉบับร่าง</Tag>}
                  {t.usedByPacks ? <Tag tone="brand">ใช้กับ {t.usedByPacks} ชุดข้อสอบ</Tag> : null}
                </div>
                <p className="text-[13px] text-ink3">แก้ล่าสุด {formatThaiDateTime(t.updatedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/certificates/templates/edit/?id=${t.id}`} className={`${linkBtn} bg-brand text-on-fill hover:bg-brand-dark`}>
                  <Icon name="edit" size={17} />
                  แก้ไข
                </Link>
                <Button size="sm" kind="ghost" icon="content_copy" onClick={() => void create(t.id, t.name)}>
                  คัดลอก
                </Button>
                {confirmId === t.id ? (
                  <Button size="sm" kind="ghost" onClick={() => setConfirmId(null)}>
                    ยกเลิก
                  </Button>
                ) : null}
                <Button size="sm" kind="danger" icon="delete" onClick={() => void remove(t)}>
                  {confirmId === t.id ? "ยืนยันลบ" : "ลบ"}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
