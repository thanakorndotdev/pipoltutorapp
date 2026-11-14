"use client";
import { useState } from "react";
export function DeleteAccount() {
  const [open, setOpen] = useState(false),
    [policy, setPolicy] = useState("revoke"),
    [confirmation, setConfirmation] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    try {
      const r = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          certificatePolicy: policy,
          confirmation,
          consent,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "ลบบัญชีไม่สำเร็จ");
      // Full navigation clears any cached authenticated Server Component payloads.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-[20px] border border-border bg-card p-5">
      <button
        type="button"
        className="min-h-[44px] text-red underline"
        onClick={() => setOpen(!open)}
      >
        ขอลบบัญชี
      </button>
      {open ? (
        <div className="mt-4 flex flex-col gap-4 text-[16px]">
          <p>
            ข้อมูลโปรไฟล์และเซสชันจะถูกลบหรือทำให้ไม่ระบุตัวบุคคล
            ประวัติที่จำเป็นต่อการตรวจสอบจะเก็บตามนโยบายที่ Owner อนุมัติ
            เลือกการจัดการเกียรติบัตรก่อนยืนยัน
          </p>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name="certificate-policy"
              checked={policy === "revoke"}
              onChange={() => setPolicy("revoke")}
            />
            เพิกถอนเกียรติบัตรและลบชื่อออกจากใบ
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name="certificate-policy"
              checked={policy === "keep"}
              onChange={() => setPolicy("keep")}
            />
            คงเกียรติบัตรและชื่อที่ลงนามไว้เพื่อการตรวจสอบ
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            ยินยอมตามตัวเลือกนี้และรับทราบว่าการลบบัญชีเรียกคืนไม่ได้
          </label>
          <label className="flex flex-col gap-2">
            พิมพ์ “ลบบัญชีของฉัน” เพื่อยืนยัน
            <input
              className="min-h-[48px] rounded-[12px] border border-border px-4"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" className="text-red">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="min-h-[48px] self-start rounded-full bg-red px-6 text-on-fill disabled:opacity-50"
            disabled={busy || !consent || confirmation !== "ลบบัญชีของฉัน"}
            onClick={() => void remove()}
          >
            {busy ? "กำลังดำเนินการ…" : "ยืนยันลบบัญชี"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
