"use client";

import { useState, type FormEvent } from "react";

import { Button, Icon } from "@/components/ui";

type Result = { kind: "match" } | { kind: "no_match" } | { kind: "error"; message: string } | null;

/**
 * CERT-10: the checker types the name printed on the certificate; the server
 * answers only "ตรง" or "ไม่ตรง" and never sends the real name back.
 */
export function NameCheck({ publicId }: { publicId: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cert/${encodeURIComponent(publicId)}/verify-name`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => null)) as { match?: boolean; error?: string } | null;
      if (!res.ok) setResult({ kind: "error", message: data?.error ?? "ตรวจสอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง" });
      else setResult({ kind: data?.match ? "match" : "no_match" });
    } catch {
      setResult({ kind: "error", message: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="cert-name" className="font-display text-[16px] font-medium">
        ตรวจชื่อบนเกียรติบัตร
      </label>
      <p className="text-[14.5px] text-ink2">พิมพ์ชื่อ หรือนามสกุล ตามที่เห็นบนเกียรติบัตร ระบบจะบอกเพียงว่าตรงกับข้อมูลที่ออกให้หรือไม่</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id="cert-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setResult(null);
          }}
          maxLength={200}
          autoComplete="off"
          placeholder="ชื่อ หรือ นามสกุล"
          className="min-h-[52px] w-full min-w-0 flex-1 rounded-[16px] border-[1.5px] border-border bg-page px-4 text-[16px] text-ink placeholder:text-ink3"
        />
        <Button type="submit" kind="brand" icon="fact_check" disabled={busy || !name.trim()}>
          {busy ? "กำลังตรวจ…" : "ตรวจสอบ"}
        </Button>
      </div>
      <div aria-live="polite">
        {result?.kind === "match" ? (
          <p className="flex items-center gap-2 rounded-[14px] bg-green-50 px-4 py-3 text-[15.5px] text-green">
            <Icon name="check_circle" size={21} fill /> ชื่อตรงกับเกียรติบัตรฉบับนี้
          </p>
        ) : result?.kind === "no_match" ? (
          <p className="flex items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-[15.5px] text-red">
            <Icon name="cancel" size={21} fill /> ชื่อไม่ตรงกับเกียรติบัตรฉบับนี้
          </p>
        ) : result?.kind === "error" ? (
          <p className="flex items-center gap-2 rounded-[14px] bg-amber-50 px-4 py-3 text-[15.5px] text-amber-ink">
            <Icon name="warning" size={21} fill /> {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
