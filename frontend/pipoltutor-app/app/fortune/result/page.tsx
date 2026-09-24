import Link from "next/link";

import { PendingPaymentWatcher } from "@/components/pending-payment-watcher";
import { SiteHeader } from "@/components/site-header";
import { SlimFooter } from "@/components/site-footer";
import { Band, Button, Card, Icon, IconTile, Pill } from "@/components/ui";
import { PCSHS_CAMPUSES } from "@/lib/campuses";
import { TUTOR_NAME } from "@/lib/content";
import { formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { fetchMyReading, fetchMyReadings, type FortuneReading, type FortuneResult } from "@/lib/fortune";
import { syncMyOrder } from "@/lib/orders";

export const metadata = { title: "คำทำนาย · PIPOL TUTOR" };

type Query = { reading?: string | string[]; order?: string | string[] };

function one(v: string | string[] | undefined): string | null {
  return typeof v === "string" && v ? v : null;
}

/**
 * Which reading to show: `?reading=` from the pay step, `?order=` from
 * Omise's return_uri via /checkout/success, else the caller's newest.
 * A pending order is synced once so a 3-D Secure return shows the real state,
 * then polled from the browser in case the charge settles a moment later.
 */
async function resolve(q: Query): Promise<{ reading: FortuneReading | null; others: FortuneReading[] }> {
  const readingId = one(q.reading);
  const orderId = one(q.order);
  const all = await fetchMyReadings();
  let reading: FortuneReading | null = null;
  if (readingId) reading = all.find((r) => r.id === readingId) ?? (await fetchMyReading(readingId));
  else if (orderId) reading = all.find((r) => r.order?.id === orderId) ?? null;
  else reading = all[0] ?? null;

  if (reading && !reading.unlocked && reading.order?.status === "pending") {
    await syncMyOrder(reading.order.id);
    reading = await fetchMyReading(reading.id);
  }
  // The list never generates; the by-id fetch writes the reading on first open.
  if (reading?.unlocked && !reading.result) reading = await fetchMyReading(reading.id);
  return { reading, others: all.filter((r) => r.id !== reading?.id) };
}

const SECTION_META: [keyof FortuneResult["sections"], string, string, string][] = [
  ["study", "menu_book", "bg-mystic-50 text-mystic", "ด้านการเรียน"],
  ["timing", "schedule", "bg-amber-50 text-amber-icon", "ช่วงเวลาที่เหมาะ"],
  ["caution", "psychology_alt", "bg-accent-50 text-accent-dark", "สิ่งที่ควรระวัง"],
];

export default async function FortuneResultPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { reading, others } = await resolve(await searchParams);
  const result = reading?.unlocked ? reading.result : null;
  const campus = reading ? PCSHS_CAMPUSES.find((c) => c.code === reading.input.campus)?.label : null;

  const status = !reading ? "none" : result ? "ready" : reading.order?.status === "failed" ? "failed" : "pending";
  const pill =
    status === "ready"
      ? ["check_circle", "bg-green-50 text-green", "คำทำนายพร้อมแล้ว"]
      : status === "failed"
        ? ["error", "bg-red-50 text-red", "ชำระเงินไม่สำเร็จ"]
        : ["hourglass_empty", "bg-mystic-50 text-[#5B21B6]", status === "pending" ? "รอชำระเงิน" : "ยังไม่มีคำทำนาย"];
  const lead =
    status === "ready" && reading
      ? `ของ ${reading.input.name}${campus ? ` · ตั้งใจสอบ ${campus}` : ""} · ประมวลผลเมื่อ ${formatThaiDateTime(result!.generatedAt)}${result!.source === "ai" ? " · เขียนโดย AI" : ""}`
      : status === "pending"
        ? "ข้อมูลถูกบันทึกแล้ว ชำระเงินให้เรียบร้อยแล้วคำทำนายจะเปิดอ่านได้ทันทีที่หน้านี้"
        : status === "failed"
          ? "การชำระเงินครั้งก่อนไม่สำเร็จ ยังไม่มีการตัดเงิน กรอกข้อมูลใหม่เพื่อเริ่มรายการอีกครั้ง"
          : "ยังไม่มีคำทำนายในบัญชีนี้ กรอกข้อมูลและชำระเงินก่อน แล้วคำทำนายจะมาแสดงที่หน้านี้";
  const action =
    status === "pending" && reading ? (
      <Button href={`/fortune/pay?reading=${encodeURIComponent(reading.id)}`} icon="lock">ไปชำระเงิน</Button>
    ) : status === "ready" ? (
      <Button href="/fortune" kind="ghost" icon="auto_awesome">ดูดวงอีกครั้ง</Button>
    ) : (
      <Button href="/fortune" kind="ghost" icon="edit">กรอกข้อมูลดูดวง</Button>
    );

  return (
    <>
      <SiteHeader current="fortune" app />
      <main className="flex-1">
        {status === "pending" && reading?.order ? <PendingPaymentWatcher orderId={reading.order.id} /> : null}
        <Band className="pb-14 pt-10 md:pb-[72px]">
          <div className="flex flex-col gap-[22px]">
            <header className="flex flex-col gap-5 rounded-[26px] border border-border bg-card p-5 shadow-m md:p-6 lg:flex-row lg:items-center">
              <IconTile icon="auto_awesome" size={86} radius={26} className="bg-mystic-50 text-mystic" />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <div>
                  <Pill icon={pill[0]} className={pill[1]}>{pill[2]}</Pill>
                </div>
                <h1 className="text-[26px] font-semibold md:text-[30px]">คำทำนายแนวทางการสอบ</h1>
                <p className="text-[16px] text-ink2">{lead}</p>
              </div>
              {action}
            </header>

            {result ? (
              <>
                <div className="flex flex-col gap-4 rounded-[26px] bg-mystic-grad p-6 text-white md:flex-row md:items-center md:gap-8">
                  <div className="flex-1">
                    <p className="text-[14px] text-[#D9CCFF]">ดาวประจำวันเกิด</p>
                    <p className="font-display text-[26px] font-semibold">{result.birthDay.label}</p>
                    <p className="text-[15px] text-[#D9CCFF]">{result.birthDay.planet}{result.timeBand ? ` · เกิด${result.timeBand.label}` : ""}</p>
                  </div>
                  <dl className="grid grid-cols-3 gap-4 md:w-[420px]">
                    <div className="rounded-[16px] bg-white/12 px-3 py-3 text-center">
                      <dt className="text-[12.5px] text-[#D9CCFF]">เลขนำโชค</dt>
                      <dd className="font-display text-[22px] font-semibold tabular">{result.lucky.numbers.join(" · ")}</dd>
                    </div>
                    <div className="rounded-[16px] bg-white/12 px-3 py-3 text-center">
                      <dt className="text-[12.5px] text-[#D9CCFF]">สีมงคล</dt>
                      <dd className="font-display text-[18px] font-semibold leading-[1.4]">{result.lucky.color}</dd>
                    </div>
                    <div className="rounded-[16px] bg-white/12 px-3 py-3 text-center">
                      <dt className="text-[12.5px] text-[#D9CCFF]">วันเกิด</dt>
                      <dd className="font-display text-[15px] font-semibold leading-[1.4]">{reading ? formatThaiDate(reading.input.dob) : "—"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
                  {SECTION_META.map(([key, icon, tile, title]) => (
                    <Card key={key} as="article" className="flex flex-col gap-3 rounded-[22px]">
                      <div className="flex items-center gap-3">
                        <IconTile icon={icon} size={40} radius={13} className={tile} />
                        <h2 className="text-[18px] font-medium">{title}</h2>
                      </div>
                      <p className="text-[15.5px] leading-[1.8] text-ink2">{result.sections[key]}</p>
                    </Card>
                  ))}
                </div>

                <Card as="section" className="flex flex-col gap-3 rounded-[22px]">
                  <div className="flex items-center gap-3">
                    <IconTile icon="question_answer" size={40} radius={13} className="bg-mystic-50 text-mystic" />
                    <h2 className="text-[18px] font-medium">คำตอบสำหรับคำถามของน้อง</h2>
                  </div>
                  <p className="rounded-[14px] bg-mystic-50 px-4 py-3 text-[15px] leading-[1.75] text-ink">“{reading?.input.question}”</p>
                  <p className="text-[15.5px] leading-[1.8] text-ink2">{result.answer.text}</p>
                </Card>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
                  <Card as="section" className="flex flex-col gap-3 rounded-[22px]">
                    <div className="flex items-center gap-3">
                      <IconTile icon="calendar_month" size={40} radius={13} className="bg-brand-50 text-brand" />
                      <h2 className="text-[18px] font-medium">ตารางอ่านหนังสือประจำสัปดาห์</h2>
                    </div>
                    <dl className="divide-y divide-border">
                      {result.schedule.map((s) => (
                        <div key={s.day} className="flex items-baseline justify-between gap-4 py-2 text-[15px]">
                          <dt className="w-[92px] shrink-0 font-display font-medium">{s.day}</dt>
                          <dd className="flex-1 text-right text-ink2">{s.focus}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                  <div className="flex flex-col gap-4">
                    <Card as="section" className="flex flex-col gap-3 rounded-[22px]">
                      <div className="flex items-center gap-3">
                        <IconTile icon="emoji_events" size={40} radius={13} className="bg-green-50 text-green" />
                        <h2 className="text-[18px] font-medium">สิ่งนำโชคของน้อง</h2>
                      </div>
                      <p className="text-[15.5px] leading-[1.8] text-ink2">{result.lucky.item}</p>
                      <p className="text-[14.5px] text-ink3">ใช้เป็นกำลังใจได้ แต่สิ่งที่เปลี่ยนคะแนนจริงคือจำนวนโจทย์ที่ทำและการทบทวนจุดที่ผิดซ้ำ</p>
                    </Card>
                    <Card as="section" className="flex flex-1 flex-col gap-3 rounded-[22px]">
                      <div className="flex items-center gap-3">
                        <IconTile icon="tips_and_updates" size={40} radius={13} className="bg-brand-50 text-brand" />
                        <h2 className="text-[18px] font-medium">คำแนะนำจาก{TUTOR_NAME}</h2>
                      </div>
                      <p className="text-[15.5px] leading-[1.8] text-ink2">{result.closing}</p>
                      <div><Button href="/exam" kind="brand" icon="quiz">ไปทำข้อสอบชุดถัดไป</Button></div>
                    </Card>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
                {SECTION_META.map(([key, icon, tile, title]) => (
                  <Card key={key} as="article" className="flex flex-col gap-3 rounded-[22px]">
                    <div className="flex items-center gap-3">
                      <IconTile icon={icon} size={40} radius={13} className={tile} />
                      <h2 className="text-[18px] font-medium">{title}</h2>
                    </div>
                    <p className="text-[15.5px] text-ink3">{status === "pending" ? "เปิดอ่านได้หลังชำระเงิน" : "ยังไม่มีคำทำนาย"}</p>
                  </Card>
                ))}
              </div>
            )}

            {others.length ? (
              <Card as="section" className="flex flex-col gap-3 rounded-[22px]">
                <h2 className="text-[18px] font-medium">คำทำนายก่อนหน้า</h2>
                <ul className="divide-y divide-border">
                  {others.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                      <span className="min-w-0 truncate text-ink2">
                        {formatThaiDateTime(r.createdAt)} · {r.input.question}
                      </span>
                      <Link
                        href={r.unlocked ? `/fortune/result?reading=${encodeURIComponent(r.id)}` : `/fortune/pay?reading=${encodeURIComponent(r.id)}`}
                        className="inline-flex shrink-0 items-center gap-1 font-display font-medium text-mystic"
                      >
                        {r.unlocked ? "เปิดอ่าน" : r.order?.status === "failed" ? "ไม่สำเร็จ" : "ชำระเงิน"}
                        <Icon name="chevron_right" size={18} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <div className="flex items-start gap-3 rounded-[18px] border border-border bg-card px-[22px] py-[18px]">
              <Icon name="info" size={21} className="mt-0.5 text-ink3" />
              <p className="text-[14px] text-ink3">คำทำนายนี้ประมวลผลจากกติกาที่ตกลงร่วมกับผู้สอน มีไว้เพื่อความบันเทิงและเป็นแนวทางจัดตารางอ่านหนังสือเท่านั้น ไม่ใช่การพยากรณ์ผลสอบ และไม่ควรใช้แทนการเตรียมตัว</p>
            </div>
          </div>
        </Band>
      </main>
      <SlimFooter />
    </>
  );
}
