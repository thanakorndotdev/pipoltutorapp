import Link from "next/link";
import { redirect } from "next/navigation";

import { PendingPaymentWatcher } from "@/components/pending-payment-watcher";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Button, Card, Icon } from "@/components/ui";
import { fetchExamSettings, fetchProducts } from "@/lib/api";
import { EXAM_DATE_LABEL, LINE_URL, TUTOR_NAME } from "@/lib/content";
import { formatBaht, formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { fetchMyOrder, syncMyOrder, type Order } from "@/lib/orders";
import { getCopy } from "@/lib/site-texts";

export const metadata = { title: "ชำระเงินสำเร็จ · PIPOL TUTOR" };

const EMPTY = "—";
const GATEWAY_LABEL: Record<string, string> = { omise: "Omise (พร้อมเพย์ / บัตร)" };

/**
 * Landing after payment. `?order=<id>` comes from the checkout page or from
 * Omise's return_uri; a pending order is synced once so a 3-D Secure return
 * shows the real result without waiting for the webhook, and keeps being
 * polled from the browser in case the charge settles a moment later.
 */
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string | string[] }> }) {
  const raw = (await searchParams).order;
  const orderId = typeof raw === "string" ? raw : null;

  let order: Order | null = null;
  if (orderId) {
    order = await fetchMyOrder(orderId);
    if (order?.status === "pending") {
      await syncMyOrder(orderId);
      order = await fetchMyOrder(orderId);
    }
  }

  const [c, products, examDateLabel] = await Promise.all([
    getCopy(),
    fetchProducts().catch(() => []),
    fetchExamSettings()
      .then((s) => formatThaiDate(s.examDate))
      .catch(() => EXAM_DATE_LABEL),
  ]);
  const lineUrl = c.t("brand.line_url", LINE_URL);
  const tutor = c.t("brand.tutor_name", TUTOR_NAME);
  const product = order ? products.find((p) => p.id === order.productId) : undefined;
  // Omise's return_uri is shared with the fortune module; its result page owns that flow.
  if (order && product?.kind === "fortune") redirect(`/fortune/result?order=${encodeURIComponent(order.id)}`);

  const paid = order?.status === "paid";
  const rows: [string, string][] = [
    ["หมายเลขคำสั่งซื้อ", order ? order.id.slice(0, 8).toUpperCase() : EMPTY],
    ["รายการ", product?.title ?? EMPTY],
    ["วิธีชำระเงิน", order?.gateway ? (GATEWAY_LABEL[order.gateway] ?? order.gateway) : EMPTY],
    ["ชำระเมื่อ", order?.paidAt ? formatThaiDateTime(order.paidAt) : EMPTY],
    ["สิทธิ์ใช้งานถึง", paid ? examDateLabel : EMPTY],
  ];

  const title = !order ? "ไม่พบคำสั่งซื้อ" : paid ? "ชำระเงินสำเร็จแล้ว" : order.status === "failed" ? "การชำระเงินไม่สำเร็จ" : "รอการชำระเงิน";
  const tone = paid ? "border-[#BFE9D2] bg-green-50 text-green" : order?.status === "failed" ? "border-red/30 bg-red-50 text-red" : "border-border bg-page text-ink3";
  const icon = paid ? "check" : order?.status === "failed" ? "close" : "hourglass_top";

  return (
    <>
      <SiteHeader current="courses" />
      <main className="flex-1">
        {order?.status === "pending" ? <PendingPaymentWatcher orderId={order.id} /> : null}
        <Band className="pb-16 pt-12 md:pb-20 md:pt-[70px]">
          <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-5">
            <span className={`flex size-24 items-center justify-center rounded-full border-[3px] ${tone}`}>
              <Icon name={icon} size={50} />
            </span>
            <h1 className="text-center text-[30px] font-semibold md:text-[36px]">{title}</h1>
            <p className="text-center text-[16px] text-ink2">
              {!order
                ? "ลิงก์นี้ไม่มีคำสั่งซื้อที่เปิดดูได้ — ถ้าเพิ่งชำระเงิน ลองเข้าสู่ระบบด้วยบัญชีเดียวกับที่ใช้สมัคร"
                : paid
                  ? `ระบบเปิดสิทธิ์เข้าเรียนให้เรียบร้อย น้องเริ่มทำข้อสอบและดูคลิปได้ทันที${order.receiptEmail ? ` ใบเสร็จจะส่งไปที่ ${order.receiptEmail}` : ""}`
                  : order.status === "failed"
                    ? "ธนาคารไม่อนุมัติรายการหรือ QR หมดอายุ กลับไปเลือกวิธีชำระเงินใหม่ได้เลย ยังไม่มีการตัดเงิน"
                    : "ยังไม่ได้รับการยืนยันจากธนาคาร ถ้าเพิ่งสแกน QR รอสักครู่แล้วรีเฟรชหน้านี้"}
            </p>

            {paid ? (
              <div className="flex w-full flex-col gap-4 rounded-[24px] bg-gradient-to-br from-line to-[#04A445] p-[26px] shadow-m sm:flex-row sm:items-center">
                <Icon name="forum" size={38} fill className="text-white" />
                <div className="flex-1">
                  <p className="font-display text-[19px] font-medium leading-[1.4] text-white">เข้ากลุ่ม LINE ของคอร์ส</p>
                  <p className="text-[14.5px] text-[#DFF7E9]">ลิงก์นี้ใช้ได้เฉพาะบัญชีที่ชำระเงินแล้ว กรุณาเข้ากลุ่มภายใน 7 วัน</p>
                </div>
                <Button href={lineUrl} kind="light" icon="open_in_new" size="sm">เข้ากลุ่มเลย</Button>
              </div>
            ) : null}

            {order ? (
              <Card className="w-full rounded-[22px]">
                <dl className="divide-y divide-border">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3.5 py-[9px] text-[15px]">
                      <dt className="text-ink2">{k}</dt>
                      <dd className="text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[17px]">{paid ? "ยอดที่ชำระ" : "ยอดที่ต้องชำระ"}</span>
                  <span className="font-display text-[26px] font-semibold text-brand-dark">{formatBaht(order.amountSatang)}</span>
                </div>
              </Card>
            ) : null}

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              {paid ? (
                <>
                  <Button href="/exam" icon="quiz">เริ่มทำข้อสอบชุดแรก</Button>
                  <Button href="/dashboard" kind="ghost" icon="play_lesson">ไปที่คอร์สของฉัน</Button>
                </>
              ) : (
                <>
                  <Button href="/courses" icon="shopping_bag">กลับไปเลือกคอร์ส</Button>
                  <Button href={lineUrl} kind="ghost" icon="chat_bubble">ทักไลน์{tutor}</Button>
                </>
              )}
            </div>
            {!order ? (
              <Link href="/login" className="text-[15px] font-medium text-brand">
                เข้าสู่ระบบ
              </Link>
            ) : null}
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
