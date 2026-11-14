"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";

import { ImagePicker } from "@/components/image-picker";
import { Button, Card, Field, Icon, Note, PageHeader, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import type { CertElement, CertLayout, CertTemplate } from "@/lib/types";

type FieldDef = { key: string; label: string };
type TextEl = Extract<CertElement, { type: "text" }>;

const UPLOAD = /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/;
const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);
const label = (e: CertElement) => (e.type === "text" ? e.text.split("\n")[0]!.slice(0, 28) || "(ข้อความว่าง)" : e.type === "qr" ? "QR ตรวจสอบ" : "รูปภาพ");

/**
 * Template editor (SoW 3.2). The preview is the real server render of the
 * unsaved layout with sample data, so what is shown is what a certificate
 * will look like. Click or drag on the preview to place the selected element.
 */
export function TemplateEditor() {
  const id = useSearchParams().get("id");
  const { api, auth } = useAdmin();
  const uid = useId();
  const [template, setTemplate] = useState<CertTemplate | null>(null);
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<CertLayout | null>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [baseline, setBaseline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [longName, setLongName] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api<{ template: CertTemplate & { layout: CertLayout }; problems: string[]; fields: FieldDef[] }>(`/admin/cert-templates/${id}`)
      .then((r) => {
        if (cancelled) return;
        setTemplate(r.template);
        setName(r.template.name);
        setLayout(r.template.layout);
        setFields(r.fields);
        setProblems(r.problems);
        setBaseline(JSON.stringify([r.template.name, r.template.layout]));
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  // Real render of the working copy, debounced; the request carries the same auth as every admin call.
  const layoutJson = layout ? JSON.stringify(layout) : "";
  useEffect(() => {
    if (!layoutJson) return;
    let cancelled = false;
    let url: string | null = null;
    const timer = setTimeout(async () => {
      try {
        const headers = new Headers({ "content-type": "application/json" });
        if (auth?.via === "key") headers.set("x-admin-key", auth.key);
        const res = await fetch("/api/admin/cert-templates/preview", { method: "POST", headers, body: JSON.stringify({ layout: JSON.parse(layoutJson), longEnglishName: longName }) });
        if (!res.ok) throw new Error(res.status === 422 ? "มีค่าที่ไม่ถูกต้อง (เช่น รูปที่ไม่ได้อัปโหลดจากเครื่อง หรือสีไม่ใช่รูปแบบ #RRGGBB)" : `แสดงตัวอย่างไม่ได้ (${res.status})`);
        url = URL.createObjectURL(await res.blob());
        if (!cancelled) {
          setPreview(url);
          setPreviewError(null);
        }
      } catch (e) {
        if (!cancelled) setPreviewError(errorMessage(e));
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [layoutJson, longName, auth]);

  if (!id) return <Note tone="error">ไม่ได้ระบุเทมเพลต</Note>;
  if (error && !layout) return <Note tone="error">{error}</Note>;
  if (!layout || !template) return <Spinner />;

  const dirty = JSON.stringify([name, layout]) !== baseline;
  const el = layout.elements.find((e) => e.id === selected) ?? null;
  const patchLayout = (p: Partial<CertLayout>) => {
    setLayout({ ...layout, ...p });
    setNote(null);
  };
  const patchEl = (p: Partial<CertElement>) => patchLayout({ elements: layout.elements.map((e) => (e.id === selected ? ({ ...e, ...p } as CertElement) : e)) });
  const add = (e: CertElement) => {
    patchLayout({ elements: [...layout.elements, e] });
    setSelected(e.id);
  };
  const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;
  const move = (by: -1 | 1) => {
    const i = layout.elements.findIndex((e) => e.id === selected);
    const next = [...layout.elements];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    patchLayout({ elements: next });
  };

  function place(e: PointerEvent<HTMLDivElement>) {
    if (!el) return;
    const box = e.currentTarget.getBoundingClientRect();
    const round = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
    patchEl({ x: round((e.clientX - box.left) / box.width), y: round((e.clientY - box.top) / box.height) });
  }

  async function save(): Promise<boolean> {
    if (!name.trim()) return setError("กรอกชื่อเทมเพลต"), false;
    if (layout!.background && !UPLOAD.test(layout!.background)) return setError("พื้นหลังต้องอัปโหลดจากเครื่อง (ไม่รองรับลิงก์ภายนอก)"), false;
    if (layout!.elements.some((e) => e.type === "image" && !UPLOAD.test(e.url))) return setError("รูปภาพทุกชิ้นต้องอัปโหลดจากเครื่อง — อัปโหลดรูป หรือลบชิ้นที่ยังว่างออก"), false;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ template: CertTemplate & { layout: CertLayout }; problems: string[] }>(`/admin/cert-templates/${id}`, { method: "PUT", json: { name: name.trim(), layout } });
      setTemplate(r.template);
      setProblems(r.problems);
      setBaseline(JSON.stringify([r.template.name, r.template.layout]));
      setNote("บันทึกฉบับร่างแล้ว");
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      const r = await api<{ version: number }>(`/admin/cert-templates/${id}/publish`, { method: "POST" });
      setTemplate({ ...template!, publishedVersion: r.version, status: "published" });
      setNote(`เผยแพร่เป็นเวอร์ชัน ${r.version} แล้ว — เกียรติบัตรที่ออกใหม่จะใช้เวอร์ชันนี้ ใบเดิมไม่เปลี่ยนจนกว่าจะกด “ออกใบใหม่ตามเทมเพลต” ในหน้าเกียรติบัตร`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function downloadPreviewPdf() {
    setPdfBusy(true);
    setPreviewError(null);
    try {
      const headers = new Headers({ "content-type": "application/json" });
      if (auth?.via === "key") headers.set("x-admin-key", auth.key);
      const res = await fetch("/api/admin/cert-templates/preview", { method: "POST", headers, body: JSON.stringify({ layout, longEnglishName: longName, format: "pdf" }) });
      if (!res.ok) throw new Error(`สร้างตัวอย่าง PDF ไม่ได้ (${res.status}) กรุณาตรวจค่าของเทมเพลตแล้วลองใหม่`);
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "certificate-preview.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setPreviewError(errorMessage(e));
    } finally {
      setPdfBusy(false);
    }
  }

  const fit = layout.backgroundFit ?? { zoom: 1, offsetX: 0, offsetY: 0 };
  const ratio = layout.paper === "a4-landscape" ? "2000 / 1414" : "1414 / 2000";

  return (
    <>
      <PageHeader
        title="แก้ไขเทมเพลตเกียรติบัตร"
        sub="เลือกชิ้นส่วนจากรายการ แล้วคลิกหรือลากบนภาพตัวอย่างเพื่อวางตำแหน่ง ภาพตัวอย่างคือผลลัพธ์จริงจากเซิร์ฟเวอร์"
        actions={
          <Link href="/certificates/templates/" className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border-[1.5px] border-border-strong bg-card px-4 text-[15px] font-medium text-ink hover:bg-page">
            <Icon name="arrow_back" size={19} />
            เทมเพลตทั้งหมด
          </Link>
        }
      />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3 xl:sticky xl:top-8">
          <div
            className={`relative w-full overflow-hidden rounded-[14px] border border-border bg-white shadow-s ${el ? "cursor-crosshair" : ""}`}
            style={{ aspectRatio: ratio, touchAction: "none" }}
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              place(e);
            }}
            onPointerMove={(e) => dragging.current && place(e)}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
            onLostPointerCapture={() => (dragging.current = false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL of the server render */}
            {preview ? <img src={preview} alt="ตัวอย่างเกียรติบัตร" className="pointer-events-none absolute inset-0 size-full" draggable={false} /> : null}
            {el ? <span aria-hidden className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-s" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%` }} /> : null}
          </div>
          {previewError ? <Note tone="warn">{previewError}</Note> : null}
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[14px] text-ink2">
            <input type="checkbox" className="size-4 accent-brand" checked={longName} onChange={(e) => setLongName(e.target.checked)} />
            ทดสอบด้วยชื่อภาษาอังกฤษยาว (ปกติใช้ชื่อไทยยาว)
          </label>
          <Button kind="ghost" icon="picture_as_pdf" disabled={pdfBusy} onClick={() => void downloadPreviewPdf()}>
            {pdfBusy ? "กำลังสร้าง PDF…" : "ดาวน์โหลดตัวอย่าง PDF"}
          </Button>
        </div>

        <div className="flex w-full flex-col gap-4 xl:w-[420px] xl:shrink-0">
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {template.publishedVersion > 0 ? <Tag tone="green">เผยแพร่ v{template.publishedVersion}</Tag> : <Tag tone="amber">ยังไม่เผยแพร่</Tag>}
              {dirty ? <Tag tone="amber">มีการแก้ไขที่ยังไม่บันทึก</Tag> : null}
            </div>
            <Field id={`${uid}-name`} label="ชื่อเทมเพลต">
              <input id={`${uid}-name`} className={inputClass} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {problems.length ? <Note tone="warn">ยังเผยแพร่ไม่ได้: {problems.join(" · ")}</Note> : null}
            {error ? <Note tone="error">{error}</Note> : null}
            {note ? <Note tone="ok">{note}</Note> : null}
            <div className="flex flex-wrap gap-2">
              <Button icon="save" disabled={busy || !dirty} onClick={() => void save()}>
                บันทึกฉบับร่าง
              </Button>
              <Button kind="ghost" icon="publish" disabled={busy} onClick={() => void publish()}>
                เผยแพร่เวอร์ชันใหม่
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold">กระดาษและพื้นหลัง</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${uid}-paper`} label="กระดาษ">
                <select id={`${uid}-paper`} className={inputClass} value={layout.paper} onChange={(e) => patchLayout({ paper: e.target.value as CertLayout["paper"] })}>
                  <option value="a4-landscape">A4 แนวนอน</option>
                  <option value="a4-portrait">A4 แนวตั้ง</option>
                </select>
              </Field>
              <Field id={`${uid}-decor`} label="กรอบมาตรฐาน">
                <select id={`${uid}-decor`} className={inputClass} value={layout.decor} onChange={(e) => patchLayout({ decor: e.target.value as CertLayout["decor"] })}>
                  <option value="standard">แสดงกรอบ โลโก้ และเหรียญ</option>
                  <option value="none">ไม่แสดง (ใช้พื้นหลังเอง)</option>
                </select>
              </Field>
            </div>
            <Field id={`${uid}-bg`} label="ภาพพื้นหลัง" hint="อัปโหลดจากเครื่อง · PNG / JPEG ไม่เกิน 5 MB">
              <ImagePicker id={`${uid}-bg`} value={layout.background ?? ""} onChange={(url) => patchLayout({ background: url || null })} onError={setError} />
            </Field>
            {layout.background ? (
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["zoom", "ซูม", 1, 4],
                    ["offsetX", "เลื่อนซ้าย–ขวา", -1, 1],
                    ["offsetY", "เลื่อนบน–ล่าง", -1, 1],
                  ] as const
                ).map(([key, text, min, max]) => (
                  <label key={key} className="flex flex-col gap-1 text-[13px] text-ink2">
                    {text}
                    <input type="range" min={min} max={max} step={0.01} value={fit[key]} onChange={(e) => patchLayout({ backgroundFit: { ...fit, [key]: Number(e.target.value) } })} className="accent-brand" />
                  </label>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold">ชิ้นส่วนบนเกียรติบัตร</h2>
            <ul className="flex flex-col gap-1">
              {layout.elements.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-pressed={e.id === selected}
                    onClick={() => setSelected(e.id === selected ? null : e.id)}
                    className={`flex min-h-[40px] w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[14.5px] ${e.id === selected ? "bg-brand-50 text-brand" : "hover:bg-page"}`}
                  >
                    <Icon name={e.type === "text" ? "title" : e.type === "qr" ? "qr_code_2" : "image"} size={18} />
                    <span className="truncate">{label(e)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" kind="ghost" icon="title" onClick={() => add({ id: newId("text"), type: "text", text: "ข้อความใหม่", x: 0.5, y: 0.5, w: 0.6, size: 40, weight: 400, font: "body", color: "#46557a", align: "center" })}>
                ข้อความ
              </Button>
              <Button size="sm" kind="ghost" icon="add_photo_alternate" onClick={() => add({ id: newId("image"), type: "image", url: "", x: 0.5, y: 0.8, w: 0.2, h: 0.1 })}>
                รูป / โลโก้ / ลายเซ็น
              </Button>
              {layout.elements.some((e) => e.type === "qr") ? null : (
                <Button size="sm" kind="ghost" icon="qr_code_2" onClick={() => add({ id: "qr", type: "qr", x: 0.87, y: 0.79, size: 0.105 })}>
                  QR
                </Button>
              )}
            </div>
          </Card>

          {el ? (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-1">
                <h2 className="mr-auto text-[16px] font-semibold">แก้ไขชิ้นส่วน</h2>
                <Button size="sm" kind="subtle" icon="arrow_upward" title="เลื่อนลำดับขึ้น (วาดก่อน)" disabled={layout.elements[0]?.id === el.id} onClick={() => move(-1)} />
                <Button size="sm" kind="subtle" icon="arrow_downward" title="เลื่อนลำดับลง (วาดทับ)" disabled={layout.elements[layout.elements.length - 1]?.id === el.id} onClick={() => move(1)} />
                <Button
                  size="sm"
                  kind="subtle"
                  icon="delete"
                  title="ลบชิ้นส่วนนี้"
                  onClick={() => {
                    patchLayout({ elements: layout.elements.filter((e) => e.id !== el.id) });
                    setSelected(null);
                  }}
                />
              </div>
              {el.type === "text" ? (
                <>
                  <Field id={`${uid}-text`} label="ข้อความ" hint="กดปุ่มด้านล่างเพื่อแทรกข้อมูลของผู้รับ · บรรทัดที่ข้อมูลว่างทั้งบรรทัดจะไม่ถูกพิมพ์">
                    <textarea id={`${uid}-text`} rows={3} className={`${inputClass} leading-[1.7]`} maxLength={1000} value={el.text} onChange={(e) => patchEl({ text: e.target.value })} />
                  </Field>
                  <div className="flex flex-wrap gap-1.5">
                    {fields.map((f) => (
                      <button key={f.key} type="button" onClick={() => patchEl({ text: `${el.text}{${f.key}}` })} className="min-h-[36px] rounded-full border border-border px-3 text-[13px] text-ink2 hover:bg-page">
                        + {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id={`${uid}-size`} label="ขนาดตัวอักษร">
                      <input id={`${uid}-size`} type="number" min={8} max={400} className={`${inputClass} tabular`} value={el.size} onChange={(e) => patchEl({ size: num(e.target.value, el.size) })} />
                    </Field>
                    <Field id={`${uid}-color`} label="สี">
                      <input id={`${uid}-color`} type="color" className="h-[44px] w-full cursor-pointer rounded-[12px] border-[1.5px] border-border bg-page p-1" value={el.color} onChange={(e) => patchEl({ color: e.target.value })} />
                    </Field>
                    <Field id={`${uid}-font`} label="แบบอักษร">
                      <select id={`${uid}-font`} className={inputClass} value={el.font} onChange={(e) => patchEl({ font: e.target.value as TextEl["font"] })}>
                        <option value="display">Mitr (หัวเรื่อง)</option>
                        <option value="body">Anuphan (เนื้อความ)</option>
                      </select>
                    </Field>
                    <Field id={`${uid}-weight`} label="ความหนา">
                      <select id={`${uid}-weight`} className={inputClass} value={el.weight} onChange={(e) => patchEl({ weight: Number(e.target.value) as TextEl["weight"] })}>
                        <option value={400}>ปกติ</option>
                        <option value={500}>กลาง</option>
                        <option value={600}>หนา</option>
                      </select>
                    </Field>
                    <Field id={`${uid}-align`} label="จัดแนว">
                      <select id={`${uid}-align`} className={inputClass} value={el.align} onChange={(e) => patchEl({ align: e.target.value as TextEl["align"] })}>
                        <option value="left">ชิดซ้าย</option>
                        <option value="center">กึ่งกลาง</option>
                        <option value="right">ชิดขวา</option>
                      </select>
                    </Field>
                    <Field id={`${uid}-w`} label="กว้างสุด (% ของกระดาษ)">
                      <input id={`${uid}-w`} type="number" min={2} max={100} className={`${inputClass} tabular`} value={Math.round(el.w * 100)} onChange={(e) => patchEl({ w: num(e.target.value, el.w * 100) / 100 })} />
                    </Field>
                    <Field id={`${uid}-leading`} label="ระยะห่างบรรทัด">
                      <input id={`${uid}-leading`} type="number" min={1.6} max={3} step={0.1} className={inputClass} value={el.lineHeight ?? 1.6} onChange={(e) => patchEl({ lineHeight: num(e.target.value, el.lineHeight ?? 1.6) })} />
                    </Field>
                  </div>
                  <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[14.5px]">
                    <input type="checkbox" className="size-5 accent-brand" checked={Boolean(el.fit)} onChange={(e) => patchEl({ fit: e.target.checked })} />
                    บรรทัดเดียว ย่อตัวอักษรให้พอดีความกว้าง (เหมาะกับชื่อ)
                  </label>
                </>
              ) : el.type === "image" ? (
                <>
                  <ImagePicker id={`${uid}-img`} value={el.url} onChange={(url) => patchEl({ url })} onError={setError} />
                  <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={!!el.crop} onChange={e=>patchEl({crop:e.target.checked?{zoom:1,offsetX:0,offsetY:0}:undefined})}/>ครอปรูปให้เต็มกรอบ</label>
                  {el.crop?<div className="grid gap-3 sm:grid-cols-3">{(["zoom","offsetX","offsetY"] as const).map(key=><label key={key} className="text-[14px]">{key==="zoom"?"ซูม":key==="offsetX"?"เลื่อนซ้าย–ขวา":"เลื่อนบน–ล่าง"}<input aria-label={key} className="min-h-[44px] w-full accent-brand" type="range" min={key==="zoom"?1:-1} max={key==="zoom"?4:1} step={0.01} value={el.crop![key]} onChange={e=>patchEl({crop:{...el.crop!,[key]:Number(e.target.value)}})}/></label>)}</div>:null}
                  <div className="grid grid-cols-2 gap-3">
                    <Field id={`${uid}-iw`} label="กว้าง (%)">
                      <input id={`${uid}-iw`} type="number" min={1} max={100} className={`${inputClass} tabular`} value={Math.round(el.w * 100)} onChange={(e) => patchEl({ w: num(e.target.value, el.w * 100) / 100 })} />
                    </Field>
                    <Field id={`${uid}-ih`} label="สูง (%)">
                      <input id={`${uid}-ih`} type="number" min={1} max={100} className={`${inputClass} tabular`} value={Math.round(el.h * 100)} onChange={(e) => patchEl({ h: num(e.target.value, el.h * 100) / 100 })} />
                    </Field>
                  </div>
                </>
              ) : (
                <Field id={`${uid}-qr`} label="ขนาด QR (% ของความกว้างกระดาษ)" hint="ไม่ควรต่ำกว่า 8% เพื่อให้สแกนได้หลังย่อรูป">
                  <input id={`${uid}-qr`} type="number" min={5} max={40} className={`${inputClass} tabular`} value={Math.round(el.size * 100)} onChange={(e) => patchEl({ size: num(e.target.value, el.size * 100) / 100 })} />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                {(["x", "y"] as const).map((axis) => (
                  <Field key={axis} id={`${uid}-${axis}`} label={axis === "x" ? "ตำแหน่งจากซ้าย (%)" : "ตำแหน่งจากบน (%)"}>
                    <input id={`${uid}-${axis}`} type="number" min={-50} max={150} step={0.1} className={inputClass} value={Math.round(el[axis] * 1000) / 10} onChange={(e) => patchEl({ [axis]: num(e.target.value, el[axis] * 100) / 100 })} />
                  </Field>
                ))}
              </div>
            </Card>
          ) : (
            <Note>เลือกชิ้นส่วนจากรายการด้านบนเพื่อแก้ไขหรือย้ายตำแหน่ง</Note>
          )}
        </div>
      </div>
    </>
  );
}
