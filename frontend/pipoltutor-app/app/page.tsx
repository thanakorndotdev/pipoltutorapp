import { DEFAULT_HERO_CHIPS, DEFAULT_HERO_FOOTNOTE, HeroCopy, PlanGrid, Portrait } from "@/components/blocks";
import { Suspense } from "react";

import { CountdownSection } from "@/components/countdown-section";
import { SiteHeader } from "@/components/site-header";
import { CtaBand, SiteFooter } from "@/components/site-footer";
import { Band, Button, Card, Icon, MenuCard, SectionHead } from "@/components/ui";
import { LINE_URL, TUTOR_NAME } from "@/lib/content";
import { getCopy } from "@/lib/site-texts";

const FEATURE_CARDS = [
  { icon: "record_voice_over", tile: "bg-brand-50 text-brand", href: "/courses/full-course" },
  { icon: "quiz", tile: "bg-teal-50 text-teal", href: "/exam" },
  { icon: "insights", tile: "bg-accent-50 text-accent-dark", href: "/exam/result" },
  { icon: "forum", tile: "bg-green-50 text-green", href: "LINE" },
];
const DEFAULT_FEATURES: string[][] = [
  ["ติวสดทุกสัปดาห์", `${TUTOR_NAME}สอนเองครบทั้ง 5 วิชา มีคลิปย้อนหลังดูซ้ำได้ไม่จำกัด`, "สอนสด 24 ครั้ง"],
  ["คลังข้อสอบจำลอง 100 ข้อ", "ทำเสมือนจริง จับเวลา เลื่อนทีละข้อ ปักธงข้อที่ไม่มั่นใจไว้ได้", "ทำซ้ำได้ 3 ครั้ง"],
  ["ตรวจและวิเคราะห์ทันที", "ตรวจบนเซิร์ฟเวอร์ สรุปคะแนนรายบท บอกจุดที่ต้องซ่อมก่อน", "รู้ผลทันทีที่ส่ง"],
  ["กลุ่ม LINE ส่วนตัว", "จ่ายเงินเสร็จระบบส่งลิงก์เข้ากลุ่มอัตโนมัติ ถามได้จนถึงวันสอบ", "ตอบเองทุกคำถาม"],
];
const PARENT_CARDS = [
  { icon: "verified_user", tile: "bg-brand-50 text-brand", href: "/about" },
  { icon: "insights", tile: "bg-teal-50 text-teal", href: "/exam/result" },
  { icon: "volunteer_activism", tile: "bg-green-50 text-green", href: "#" },
];
const DEFAULT_PARENTS: string[][] = [
  [`${TUTOR_NAME}สอนเองทุกคาบ`, "ศิษย์เก่า จภ. เข้า ม.1 ปี 2560 สอนเองครบทั้ง 5 วิชา ไม่มีติวเตอร์มาสอนแทน", `ดูประวัติ${TUTOR_NAME}`],
  ["เห็นความคืบหน้าทุกสัปดาห์", "ทำข้อสอบเสร็จมีรายงานคะแนนรายบททันที รู้ว่าน้องยังอ่อนบทไหนก่อนถึงวันสอบ", "รายงานส่งเข้ากลุ่ม LINE"],
  ["ไม่ตรงกับที่คิดไว้ คืนเงินได้", "เรียนแล้วรู้สึกไม่ตรงกับที่คาดไว้ ทักมาในกลุ่มได้เลย คืนเงินตามเงื่อนไขที่เขียนไว้ชัด", "อ่านนโยบายคืนเงิน"],
];

const DEFAULT_REVIEWS: string[][] = [
  ["น้องมิว ผู้ปกครอง", "ลูกทำข้อสอบเสร็จแล้วเห็นเลยว่ายังอ่อนบทไหน กลับไปซ่อมได้ตรงจุด ไม่ต้องเดาเอง"],
  ["น้องปัน สอบติด จภ. ปทุมธานี", "ชอบที่ถามในกลุ่ม LINE แล้วได้คำตอบเร็ว ข้อสอบจำลองเหมือนของจริงมาก"],
  ["คุณแม่น้องแพร", `${TUTOR_NAME}สอนเองทุกคาบจริง ๆ เห็นรายงานคะแนนทุกสัปดาห์ สบายใจว่าลูกพร้อมแค่ไหน`],
];

export default async function Home() {
  const c = await getCopy();
  const lineUrl = c.t("brand.line_url", LINE_URL);
  const features = c.rows("home.features", DEFAULT_FEATURES);
  const parents = c.rows("home.parents", DEFAULT_PARENTS);
  // Admin-edited "ชื่อ | คอมเมนต์" lines; an empty override hides the section.
  const reviews = c.rows("home.reviews", DEFAULT_REVIEWS).filter(([name, quote]) => name && quote);
  return (
    <>
      <SiteHeader current="home" />
      <main className="flex-1">
        <Band className="pb-14 pt-8 md:pb-20 md:pt-14">
          <div className="flex flex-col gap-9 lg:flex-row lg:items-center lg:gap-[58px]">
            <HeroCopy
              pill={c.t("home.hero_pill", "เปิดรับสมัครแล้ว")}
              pillIcon="local_fire_department"
              title={
                <>
                  {c.t("home.hero_title_1", `ติวเข้า ม.1 จภ. กับ${TUTOR_NAME}`)}
                  <br />
                  {c.t("home.hero_title_2", "ติวเตอร์ที่สอบเข้าเองมาก่อน")}
                </>
              }
              lede={c.t("home.hero_lede", "คอร์สสอนสดครบ 5 วิชาตามแนวข้อสอบจริง พร้อมคลังข้อสอบเสมือนจริง 100 ข้อ ตรวจอัตโนมัติ และรายงานว่าน้องยังต้องซ่อมบทไหนบ้าง")}
              ctas={
                <>
                  <Button href="/exam" icon="play_circle">{c.t("home.hero_cta_primary", "ลองทำข้อสอบฟรี 10 ข้อ")}</Button>
                  <Button href="/courses" kind="ghost" icon="school">{c.t("home.hero_cta_secondary", "ดูคอร์สและราคา")}</Button>
                </>
              }
              chips={c.rows("home.hero_chips", DEFAULT_HERO_CHIPS)}
              footnote={c.t("home.hero_footnote", DEFAULT_HERO_FOOTNOTE)}
            />
            <Portrait />
          </div>
        </Band>

        <Band tone="card" className="pb-10 pt-14 md:pt-[76px]">
          <div className="flex flex-col items-center gap-10">
            <SectionHead
              center
              title={c.t("home.features_title", "เราทำอะไรให้น้องบ้าง")}
              sub={c.t("home.features_sub", "ไม่ใช่แค่คอร์สติว แต่เป็นระบบเตรียมสอบที่ทำให้รู้ว่าตอนนี้ยืนอยู่ตรงไหน และต้องซ่อมตรงไหนต่อ")}
            />
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {features.slice(0, FEATURE_CARDS.length).map(([title, desc = "", meta = ""], i) => (
                <MenuCard key={title} icon={FEATURE_CARDS[i].icon} tileClass={FEATURE_CARDS[i].tile} title={title} desc={desc} meta={meta} href={FEATURE_CARDS[i].href === "LINE" ? lineUrl : FEATURE_CARDS[i].href} />
              ))}
            </div>
          </div>
        </Band>

        <Band tone="card" className="pb-10 pt-14 md:pt-[76px]">
          <div className="flex flex-col items-center gap-10">
            <SectionHead
              center
              title={c.t("home.parents_title", `ถึงผู้ปกครอง — สิ่งที่${TUTOR_NAME}สัญญาไว้`)}
              sub={c.t("home.parents_sub", "อยากให้เห็นภาพให้ครบก่อนตัดสินใจ ไม่มีโทรตาม ไม่มีการตื๊อให้สมัคร")}
            />
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
              {parents.slice(0, PARENT_CARDS.length).map(([title, desc = "", meta = ""], i) => (
                <MenuCard key={title} icon={PARENT_CARDS[i].icon} tileClass={PARENT_CARDS[i].tile} title={title} desc={desc} meta={meta} href={PARENT_CARDS[i].href} />
              ))}
            </div>
            <p className="text-center text-[15px] text-ink3">
              {c.t("home.parents_note", `ถามก่อนได้ ไม่ต้องสมัคร — ทักไลน์มาคุยกับ${TUTOR_NAME}เรื่องแนวทางของน้องก่อนได้เลย`)}
            </p>
          </div>
        </Band>

        {reviews.length > 0 ? (
          <Band tone="card" className="pb-10 pt-14 md:pt-[76px]">
            <div className="flex flex-col items-center gap-10">
              <SectionHead
                center
                title={c.t("home.reviews_title", "เสียงจากน้องและผู้ปกครอง")}
                sub={c.t("home.reviews_sub", "คอมเมนต์จากผู้ที่เรียนกับเรา")}
              />
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                {reviews.map(([name, quote]) => (
                  <Card as="article" key={`${name}-${quote}`} className="flex flex-col gap-4">
                    <Icon name="format_quote" size={30} fill className="text-brand" />
                    <p className="text-[16px] text-ink2">{quote}</p>
                    <p className="mt-auto text-[14.5px] font-medium">— {name}</p>
                  </Card>
                ))}
              </div>
            </div>
          </Band>
        ) : null}

        <Band className="pb-10 pt-8">
          <Suspense fallback={<div className="bg-brand-grad min-h-[260px] rounded-[28px] shadow-l" aria-hidden />}>
            <CountdownSection />
          </Suspense>
        </Band>

        <Band tone="card" className="pb-10 pt-14 md:pt-[76px]">
          <div className="flex flex-col items-center gap-10">
            <SectionHead
              center
              title={c.t("home.plans_title", "ถ้าพร้อมแล้ว เลือกแบบที่ตรงกับน้องที่สุด")}
              sub={c.t("home.plans_sub", "ดูให้ครบก่อนค่อยตัดสินใจ จ่ายครั้งเดียวใช้ได้ถึงวันสอบ ชำระเงินเสร็จระบบเปิดสิทธิ์ทันทีพร้อมส่งลิงก์เข้ากลุ่ม LINE")}
            />
            <PlanGrid />
          </div>
        </Band>

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
