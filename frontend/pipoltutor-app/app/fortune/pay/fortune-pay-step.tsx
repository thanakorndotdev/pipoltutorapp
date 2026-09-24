"use client";

import { useState } from "react";

import { PaymentStep } from "@/app/checkout/payment-step";
import { Button } from "@/components/ui";

/**
 * Parent-consent gate in front of the shared PaymentStep. The tick is
 * recorded on the reading before the charge starts so the order carries it.
 */
export function FortunePayStep({
  readingId,
  orderId,
  amountSatang,
  initialConsent,
}: {
  readingId: string;
  orderId: string;
  amountSatang: number;
  initialConsent: boolean;
}) {
  const [consent, setConsent] = useState(initialConsent);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successHref = `/fortune/result?reading=${encodeURIComponent(readingId)}`;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/fortune/readings/${encodeURIComponent(readingId)}/consent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parentConsent: true }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "บันทึกไม่สำเร็จ");
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) return <PaymentStep orderId={orderId} amountSatang={amountSatang} successHref={successHref} />;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-amber-50 px-[18px] py-4">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-6 shrink-0 accent-amber" />
        <span>
          <span className="block font-display text-[15.5px] font-medium text-amber-ink">ผู้ปกครองรับทราบและยินยอมให้ชำระเงิน</span>
          <span className="block text-[14.5px] text-amber-ink">ผู้ซื้อเป็นนักเรียนอายุต่ำกว่า 15 ปี ระบบจึงขอให้ผู้ปกครองเป็นผู้กดยืนยันการชำระเงินทุกครั้ง</span>
        </span>
      </label>
      {error ? <p role="alert" className="text-[14.5px] text-red">{error}</p> : null}
      <Button onClick={confirm} disabled={!consent || busy} icon="lock" className="w-full">
        {busy ? "กำลังบันทึก…" : "ยืนยันและเลือกวิธีชำระเงิน"}
      </Button>
    </div>
  );
}
