import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SlimFooter } from "@/components/site-footer";
import { Band, Button, Card, Icon, IconTile, Pill } from "@/components/ui";
import { PCSHS_CAMPUSES } from "@/lib/campuses";
import { formatBaht, formatThaiDate } from "@/lib/format";
import { fetchMyReading, type FortuneReading } from "@/lib/fortune";
import { FortunePayStep } from "./fortune-pay-step";

export const metadata = { title: "ชำระค่าดูดวง · PIPOL TUTOR" };

const EMPTY = "—";

/** Read-back of what the form stored on the reading. */
function readBack(r: FortuneReading) {
  const campus = PCSHS_CAMPUSES.find((c) => c.code === r.input.campus);
  const fields: [string, string][] = [
    ["ชื่อ-นามสกุล", r.input.name || EMPTY],
    ["วันเกิด", r.input.dob ? formatThaiDate(r.input.dob) : EMPTY],
    ["เวลาเกิด", r.input.birthTime ? `${r.input.birthTime} น.` : "ไม่ระบุ"],
    ["สนามสอบที่ตั้งใจไว้", campus?.label ?? EMPTY],
  ];
  return { fields, question: r.input.question || EMPTY };
}

/**
 * Step 2: pay for the reading created by the form. `?reading=<id>` is the
 * caller's own reading; anything else shows the not-found state. A reading
 * that is already open (paid, or a staff account) skips straight to the result.
 */
export default async function FortunePayPage({ searchParams }: { searchParams: Promise<{ reading?: string | string[] }> }) {
  const raw = (await searchParams).reading;
  const id = typeof raw === "string" ? raw : null;
  const reading = id ? await fetchMyReading(id) : null;
  if (reading?.unlocked) redirect(`/fortune/result?reading=${encodeURIComponent(reading.id)}`);

  if (!reading || !reading.order) {
    return (
      <>
        <SiteHeader current="fortune" app />
        <main className="flex-1">
          <Band className="pb-14 pt-10 md:pb-[72px]">
            <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 text-center">
              <IconTile icon="search_off" size={64} radius={20} className="bg-mystic-50 text-mystic" />
              <h1 className="text-[26px] font-semibold">ไม่พบข้อมูลดูดวง</h1>
              <p className="text-[16px] text-ink2">ลิงก์นี้ไม่มีรายการดูดวงที่เปิดดูได้ กรอกข้อมูลใหม่ได้เลย ใช้เวลาไม่ถึงนาที</p>
              <Button href="/fortune" icon="auto_awesome">กรอกข้อมูลดูดวง</Button>
            </div>
          </Band>
        </main>
        <SlimFooter />
      </>
    );
  }

  const { fields, question } = readBack(reading);
  const { order } = reading;
  const failed = order.status === "failed";

  return (
    <>
      <SiteHeader current="fortune" app />
      <main className="flex-1">
        <Band tone="mystic" className="pb-11 pt-10">
          <div>
            <Pill icon="auto_awesome" className="bg-[#4A2A9E] text-white">ขั้นตอนที่ 2 จาก 2 · ชำระเงิน</Pill>
          </div>
          <h1 className="mt-3.5 text-[30px] font-semibold text-white md:text-[38px]">ชำระค่าดูดวงแนวทางการสอบ</h1>
          <p className="mt-2 text-[16.5px] text-[#D6C9FF]">จ่ายครั้งเดียว อ่านคำทำนายได้ทันทีหลังชำระเงิน และเก็บไว้เปิดดูซ้ำได้ตลอด</p>
        </Band>

        <Band className="pb-14 pt-9 md:pb-[72px]">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">
            <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
              <Card as="section" className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-semibold">ข้อมูลที่กรอกไว้</h2>
                  <Link href="/fortune" className="inline-flex items-center gap-1.5 font-display text-[14.5px] font-medium text-mystic">
                    <Icon name="edit" size={18} />กรอกใหม่
                  </Link>
                </div>
                <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {fields.map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-2">
                      <dt className="font-display text-[14.5px] font-medium">{k}</dt>
                      <dd className="rounded-[14px] border-[1.5px] border-border bg-page px-4 py-3.5 text-[16px]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-col gap-2">
                  <p className="font-display text-[14.5px] font-medium">คำถามที่น้องถาม</p>
                  <p className="rounded-[14px] bg-mystic-50 px-4 py-3.5 text-[16px] leading-[1.75]">{question}</p>
                </div>
              </Card>

              <Card as="section" className="flex flex-col gap-3.5">
                <h2 className="text-[19px] font-semibold">ชำระเงิน</h2>
                {failed ? (
                  <p className="rounded-[16px] bg-red-50 px-4 py-3.5 text-[14.5px] text-red">
                    การชำระเงินครั้งก่อนไม่สำเร็จหรือ QR หมดอายุ ยังไม่มีการตัดเงิน กรอกข้อมูลใหม่เพื่อเริ่มรายการอีกครั้ง
                  </p>
                ) : (
                  <FortunePayStep readingId={reading.id} orderId={order.id} amountSatang={order.amountSatang} initialConsent={reading.parentConsent} />
                )}
              </Card>
            </div>

            <Card as="aside" lifted className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
              <h2 className="text-[19px] font-semibold">สรุปคำสั่งซื้อ</h2>
              <div className="flex items-start gap-3.5">
                <IconTile icon="auto_awesome" size={34} radius={11} className="bg-mystic-50 text-mystic" />
                <div>
                  <p className="font-display text-[15.5px] font-medium">{reading.input.topic ?? "ดูดวงแนวทางการสอบ"} 1 ครั้ง</p>
                  <p className="text-[13.5px] text-ink3">คำทำนาย 3 ด้าน + คำตอบคำถาม + เลขนำโชค + ตารางอ่านหนังสือ</p>
                </div>
              </div>
              <hr className="border-border" />
              <dl className="flex flex-col gap-1 text-[15px]">
                <div className="flex justify-between py-1"><dt>ค่า{reading.input.topic ?? "ดูดวง"} 1 ครั้ง</dt><dd>{formatBaht(order.amountSatang)}</dd></div>
                <div className="flex justify-between py-1 text-ink3"><dt>รหัสรายการ</dt><dd className="tabular">{order.id.slice(0, 8).toUpperCase()}</dd></div>
              </dl>
              <hr className="border-border" />
              <div className="flex items-baseline justify-between">
                <span className="text-[17px]">ยอดชำระทั้งหมด</span>
                <span className="font-display text-[26px] font-semibold text-mystic">{formatBaht(order.amountSatang)}</span>
              </div>
              <div className="flex items-start gap-[11px] rounded-[16px] bg-page px-[15px] py-[13px]">
                <Icon name="info" size={19} className="mt-0.5 text-ink3" />
                <p className="text-[13px] text-ink2">ดูดวงเป็นบริการเพื่อความบันเทิงและใช้จัดตารางอ่านหนังสือ ไม่ใช่การพยากรณ์ผลสอบ และไม่มีนโยบายคืนเงินหลังเปิดอ่านคำทำนายแล้ว</p>
              </div>
            </Card>
          </div>
        </Band>
      </main>
      <SlimFooter />
    </>
  );
}
