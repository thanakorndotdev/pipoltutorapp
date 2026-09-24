import Link from "next/link";
import { notFound } from "next/navigation";

import { getPlans } from "@/components/blocks";
import { SiteImage } from "@/components/site-assets";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Button, Card, Note, Pill, Slot, Tick } from "@/components/ui";
import { COURSE_START_LABEL, EXAM_DATE_LABEL, LINE_URL, PLANS, TUTOR_NAME } from "@/lib/content";
import { formatBaht, formatThaiDate } from "@/lib/format";
import { getCopy } from "@/lib/site-texts";
import { fetchExamSettings } from "@/lib/api";

export function generateStaticParams() {
  return PLANS.map((p) => ({ slug: p.slug }));
}

type Lesson = [string, string, string, string];

/** Course-specific copy; plans without an entry fall back to their feature list. */
const DETAIL: Partial<
  Record<
    (typeof PLANS)[number]["slug"],
    { lede: string; who: string[]; lessons: Lesson[]; includes: string[] }
  >
> = {
  "full-course": {
    lede: `สอนสด 24 ครั้งโดย${TUTOR_NAME} ครบทั้ง 5 วิชาตามแนวข้อสอบคัดเลือก ม.1 พร้อมชุดข้อสอบเสมือนจริงและกลุ่ม LINE ส่วนตัวจนถึงวันสอบ`,
    who: [
      "น้อง ป.6 ที่ตั้งใจสอบเข้า ม.1 จภ. รอบคัดเลือก",
      "คนที่อ่านเองแล้วไม่รู้ว่าตัวเองอ่อนตรงไหน",
      "คนที่ทำข้อสอบไม่ทันเวลา แม้จะทำโจทย์ได้",
    ],
    lessons: [
      ["01", "คณิตศาสตร์ · พื้นฐานที่ออกสอบซ้ำทุกปี", "6 ครั้ง · จำนวน อัตราส่วน สมการ เรขาคณิต", "6 ชม."],
      ["02", "วิทยาศาสตร์ · ฟิสิกส์ เคมี ชีวะเบื้องต้น", "6 ครั้ง · เน้นโจทย์วิเคราะห์และการทดลอง", "6 ชม."],
      ["03", "ความสามารถทางเชาวน์", "5 ครั้ง · อนุกรม มิติสัมพันธ์ ตรรกะ", "5 ชม."],
      ["04", "ภาษาไทยและภาษาอังกฤษ", "4 ครั้ง · การอ่านจับใจความและคำศัพท์", "4 ชม."],
      ["05", "ตะลุยโจทย์และจับเวลาก่อนสอบ", "3 ครั้ง · ทำข้อสอบเต็มชุดพร้อมเฉลยละเอียด", "4.5 ชม."],
    ],
    includes: ["สอนสด 24 ครั้ง + คลิปย้อนหลัง", "ชุดข้อสอบเสมือนจริง 1 ชุด", "เอกสารแบบพิมพ์ส่งถึงบ้าน", "กลุ่ม LINE ส่วนตัวจนถึงวันสอบ"],
  },
};

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plan = (await getPlans()).find((p) => p.slug === slug);
  if (!plan) notFound();

  const c = await getCopy();
  const examDateLabel = await fetchExamSettings()
    .then((s) => formatThaiDate(s.examDate))
    .catch(() => EXAM_DATE_LABEL);
  const lineUrl = c.t("brand.line_url", LINE_URL);
  const tutor = c.t("brand.tutor_name", TUTOR_NAME);
  const base = DETAIL[plan.slug];
  const d = base
    ? {
        lede: c.t(`courses.${plan.slug}.lede`, base.lede),
        who: c.lines(`courses.${plan.slug}.who`, base.who),
        lessons: c.rows(`courses.${plan.slug}.lessons`, base.lessons).map(([n, title = "", sub = "", hours = ""]) => [n, title, sub, hours] as Lesson),
        includes: c.lines(`courses.${plan.slug}.includes`, base.includes),
      }
    : undefined;
  const includes = d?.includes ?? plan.feats;

  return (
    <>
      <SiteHeader current="courses" />
      <main className="flex-1">
        <Band className="pb-14 pt-8 md:pb-[72px] md:pt-9">
          <p className="text-[14px] text-ink3">
            <Link href="/courses" className="hover:text-brand">คอร์สเรียน</Link> · {plan.name}
          </p>

          <div className="mt-4 flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">
            <div className="min-w-0 flex-1">
              <div>
                <Pill icon="local_fire_department" className="bg-accent-50 text-accent-dark">
                  เปิดรับสมัครแล้ว
                </Pill>
              </div>
              <h1 className="mt-3.5 text-[32px] font-semibold md:text-[40px]" style={{ textWrap: "balance" }}>
                {plan.name}
              </h1>
              <p className="mt-3.5 text-[17px] text-ink2 md:text-[18px]">{d?.lede ?? plan.desc}</p>

              <div className="mt-[26px] max-w-[820px]">
                <SiteImage slot={`course_${plan.slug}`} ratio="16 / 9" className="shadow-m">
                  <Slot
                    icon="smart_display"
                    title="คลิปแนะนำคอร์ส"
                    note={`แนวนอน 16:9 · ${TUTOR_NAME}พูดแนะนำคอร์ส 60–90 วินาที`}
                    ratio="16 / 9"
                    className="shadow-m"
                  />
                </SiteImage>
              </div>

              {d ? (
                <>
                  <h2 className="mt-[34px] text-[22px] font-semibold">คอร์สนี้เหมาะกับใคร</h2>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {d.who.map((w) => (
                      <Tick key={w}>{w}</Tick>
                    ))}
                  </ul>

                  <h2 className="mt-[34px] text-[22px] font-semibold">เนื้อหาในคอร์ส</h2>
                  <Card className="mt-4 divide-y divide-border px-[22px] py-2">
                    {d.lessons.map(([n, title, sub, hours]) => (
                      <div key={n} className="flex items-start gap-3.5 py-[15px]">
                        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-brand-50 font-display text-[14px] font-medium text-brand-dark">
                          {n}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[16px] font-medium leading-[1.45]">{title}</p>
                          <p className="text-[14px] text-ink3">{sub}</p>
                        </div>
                        <span className="whitespace-nowrap text-[13.5px] text-ink3">{hours}</span>
                      </div>
                    ))}
                  </Card>
                </>
              ) : (
                <>
                  <h2 className="mt-[34px] text-[22px] font-semibold">สิ่งที่ได้รับ</h2>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {plan.feats.map((f) => (
                      <Tick key={f}>{f}</Tick>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <Card as="aside" lifted className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
              <div>
                <Pill icon="event_available">เริ่มเรียน {c.t("courses.start_label", COURSE_START_LABEL)}</Pill>
              </div>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[36px] font-semibold leading-[1.12]">{formatBaht(plan.price * 100)}</span>
                <span className="text-[14px] text-ink3">จ่ายครั้งเดียว</span>
              </p>
              <p className="text-[14.5px] text-ink2">ใช้สิทธิ์ได้ถึงวันสอบ {examDateLabel}</p>
              <Button href={`/checkout?product=${plan.slug}`} icon="shopping_cart" className="w-full">{plan.cta}</Button>
              <Button href={lineUrl} kind="line" icon="chat_bubble" className="w-full">ถาม{tutor}ก่อนตัดสินใจ</Button>
              <hr className="border-border" />
              <ul className="flex flex-col gap-2.5">
                {includes.map((t) => (
                  <Tick key={t}>{t}</Tick>
                ))}
              </ul>
              <Note icon="lock">ชำระเงินผ่านระบบที่ปลอดภัย ระบบเปิดสิทธิ์อัตโนมัติทันทีที่ชำระสำเร็จ</Note>
            </Card>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}

