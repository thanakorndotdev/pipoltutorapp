"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui";
import { formatBaht } from "@/lib/format";

export type PaymentMethod = "promptpay" | "card";

type Config = { provider: string; configured: boolean; publicKey: string; methods: PaymentMethod[] };
type Charge = {
  id: string;
  status: string;
  paid: boolean;
  method: string;
  qrImageUrl: string | null;
  authorizeUri: string | null;
  expiresAt: string | null;
  failureMessage: string | null;
};
type ChargeResponse = { order: { id: string; status: string }; charge: Charge | null; error?: string };

type OmiseJs = {
  setPublicKey: (key: string) => void;
  createToken: (
    type: "card",
    card: { name: string; number: string; expiration_month: number; expiration_year: number; security_code: string },
    cb: (statusCode: number, response: { id?: string; message?: string; card?: { last_digits?: string } }) => void
  ) => void;
};
declare global {
  interface Window {
    Omise?: OmiseJs;
  }
}

const OMISE_JS = "https://cdn.omise.co/omise.js";
const POLL_MS = 4000;

function loadOmiseJs(): Promise<OmiseJs> {
  return new Promise((resolve, reject) => {
    if (window.Omise) return resolve(window.Omise);
    const s = document.createElement("script");
    s.src = OMISE_JS;
    s.async = true;
    s.onload = () => (window.Omise ? resolve(window.Omise) : reject(new Error("Omise.js did not initialise")));
    s.onerror = () => reject(new Error("โหลดสคริปต์ชำระเงินไม่ได้"));
    document.head.appendChild(s);
  });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? `ผิดพลาด (${res.status})`);
  return data;
}

/**
 * Step 3: pay for a created order. PromptPay shows a QR and polls
 * /api/payments/sync until Omise reports the charge; card tokenises in the
 * browser with Omise.js (the number never touches our servers) and follows
 * the 3-D Secure redirect when the bank asks for it.
 */
export function PaymentStep({ orderId, amountSatang, successHref }: { orderId: string; amountSatang: number; successHref?: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [charge, setCharge] = useState<Charge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvc: "" });
  const pollRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/payments/config")
      .then((r) => r.json())
      .then((c: Config) => setConfig(c))
      .catch(() => setConfig({ provider: "omise", configured: false, publicKey: "", methods: [] }));
  }, []);

  const goSuccess = () => router.push(successHref ?? `/checkout/success?order=${encodeURIComponent(orderId)}`);

  // Poll while a PromptPay QR is on screen.
  useEffect(() => {
    if (!charge || charge.method !== "promptpay" || charge.status !== "pending") return;
    const tick = async () => {
      try {
        const r = await postJson<ChargeResponse>("/api/payments/sync", { orderId });
        if (r.order.status === "paid") return goSuccess();
        if (r.charge) setCharge(r.charge);
        if (r.order.status === "failed") setError("QR หมดอายุหรือการชำระเงินไม่สำเร็จ กดสร้าง QR ใหม่ได้เลย");
      } catch {
        /* transient; next tick retries */
      }
    };
    pollRef.current = window.setInterval(tick, POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goSuccess is stable per orderId/successHref
  }, [charge?.id, charge?.status, charge?.method, orderId, successHref]);

  async function startPromptPay() {
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<ChargeResponse>("/api/payments/charge", { orderId, method: "promptpay" });
      if (r.order.status === "paid") return goSuccess();
      setCharge(r.charge);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function payCard() {
    if (!config?.publicKey) return;
    const [mm, yy] = card.expiry.split("/").map((s) => s.trim());
    const month = Number(mm);
    const year = yy?.length === 2 ? 2000 + Number(yy) : Number(yy);
    if (!card.name.trim() || card.number.replace(/\s/g, "").length < 12 || !month || !year || card.cvc.length < 3) {
      setError("กรอกข้อมูลบัตรให้ครบ: ชื่อบนบัตร เลขบัตร วันหมดอายุ (MM/YY) และ CVC");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const Omise = await loadOmiseJs();
      Omise.setPublicKey(config.publicKey);
      const token = await new Promise<string>((resolve, reject) =>
        Omise.createToken(
          "card",
          { name: card.name.trim(), number: card.number.replace(/\s/g, ""), expiration_month: month, expiration_year: year, security_code: card.cvc },
          (code, res) => (code === 200 && res.id ? resolve(res.id) : reject(new Error(res.message ?? "ข้อมูลบัตรไม่ถูกต้อง")))
        )
      );
      const r = await postJson<ChargeResponse>("/api/payments/charge", { orderId, method: "card", token });
      if (r.order.status === "paid") return goSuccess();
      if (r.charge?.authorizeUri) return window.location.assign(r.charge.authorizeUri);
      if (r.order.status === "failed") throw new Error(r.charge?.failureMessage ?? "ธนาคารปฏิเสธรายการ กรุณาลองบัตรอื่น");
      setCharge(r.charge);
      const s = await postJson<ChargeResponse>("/api/payments/sync", { orderId });
      if (s.order.status === "paid") return goSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!config) return <p className="text-[15px] text-ink3">กำลังโหลดวิธีชำระเงิน…</p>;
  if (!config.configured) {
    return (
      <p className="rounded-[16px] bg-amber-50 px-4 py-3.5 text-[14.5px] text-amber-ink">
        ระบบชำระเงินออนไลน์ยังไม่เปิดใช้งาน — บันทึกคำสั่งซื้อไว้แล้ว (รหัส {orderId.slice(0, 8)}) ทักไลน์เพื่อชำระเงินและเปิดสิทธิ์ได้เลย
      </p>
    );
  }

  const showQr = charge?.method === "promptpay" && charge.status === "pending" && charge.qrImageUrl;

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="วิธีชำระเงิน" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            ["promptpay", "พร้อมเพย์ / สแกน QR", "สแกนด้วยแอปธนาคาร ระบบตรวจสอบให้อัตโนมัติ", "qr_code_2"],
            ["card", "บัตรเครดิต / เดบิต", "Visa, Mastercard, JCB", "credit_card"],
          ] as const
        ).map(([id, title, detail, icon]) => {
          const selected = id === method;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy || Boolean(showQr)}
              onClick={() => {
                setMethod(id);
                setError(null);
              }}
              className={`flex min-h-[44px] items-center gap-3.5 rounded-[18px] border-[1.5px] p-4 text-left disabled:opacity-60 ${selected ? "border-brand bg-brand-50" : "border-border"}`}
            >
              <Icon name={icon} size={24} className={selected ? "text-brand" : "text-ink3"} />
              <span className="min-w-0 flex-1">
                <span className="display block text-[16px] font-medium">{title}</span>
                <span className="block text-[14px] text-ink3">{detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      {method === "promptpay" ? (
        showQr ? (
          <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border bg-page p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Omise-hosted QR */}
            <img src={charge.qrImageUrl ?? ""} alt="QR พร้อมเพย์" className="size-[240px] rounded-[12px] bg-white p-2" />
            <p className="font-display text-[22px] font-semibold">{formatBaht(amountSatang)}</p>
            <p className="text-[14.5px] text-ink2">เปิดแอปธนาคาร สแกน QR แล้วยืนยัน — หน้านี้จะเปลี่ยนเองเมื่อได้รับเงิน</p>
            <p className="flex items-center gap-2 text-[13.5px] text-ink3">
              <Icon name="progress_activity" size={16} className="animate-spin" />
              กำลังรอการชำระเงิน…
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={startPromptPay}
            disabled={busy}
            className="min-h-[52px] rounded-full bg-accent px-6 text-[17px] font-medium text-on-fill shadow-m disabled:opacity-60"
          >
            {busy ? "กำลังสร้าง QR…" : `สร้าง QR พร้อมเพย์ ${formatBaht(amountSatang)}`}
          </button>
        )
      ) : (
        <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-page p-5">
          <CardField label="ชื่อบนบัตร" value={card.name} onChange={(v) => setCard((c) => ({ ...c, name: v }))} autoComplete="cc-name" />
          <CardField label="เลขบัตร" value={card.number} onChange={(v) => setCard((c) => ({ ...c, number: v.replace(/[^\d ]/g, "") }))} inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" />
          <div className="grid grid-cols-2 gap-3">
            <CardField label="หมดอายุ (MM/YY)" value={card.expiry} onChange={(v) => setCard((c) => ({ ...c, expiry: v }))} inputMode="numeric" autoComplete="cc-exp" placeholder="12/28" />
            <CardField label="CVC" value={card.cvc} onChange={(v) => setCard((c) => ({ ...c, cvc: v.replace(/\D/g, "").slice(0, 4) }))} inputMode="numeric" autoComplete="cc-csc" type="password" />
          </div>
          <button
            type="button"
            onClick={payCard}
            disabled={busy}
            className="mt-1 min-h-[52px] rounded-full bg-accent px-6 text-[17px] font-medium text-on-fill shadow-m disabled:opacity-60"
          >
            {busy ? "กำลังชำระเงิน…" : `ชำระ ${formatBaht(amountSatang)}`}
          </button>
          <p className="text-[13px] text-ink3">เลขบัตรถูกเข้ารหัสและส่งตรงไปยัง Omise ไม่ผ่านเซิร์ฟเวอร์ของเรา</p>
        </div>
      )}

      {error ? (
        <p role="alert" className="rounded-[16px] bg-accent-50 px-4 py-3.5 text-[15px] text-accent-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CardField({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "numeric";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="display text-[14.5px] font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full min-h-[48px] rounded-[14px] border-[1.5px] border-border bg-card px-4 py-3 text-[16px] text-ink placeholder:text-ink3"
      />
    </label>
  );
}
