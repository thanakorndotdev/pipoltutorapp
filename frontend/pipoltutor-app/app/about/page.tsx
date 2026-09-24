import { DEFAULT_HERO_CHIPS, DEFAULT_HERO_FOOTNOTE, HeroCopy, Portrait } from "@/components/blocks";
import { SiteImage } from "@/components/site-assets";
import { SiteHeader } from "@/components/site-header";
import { CtaBand, SiteFooter } from "@/components/site-footer";
import { Band, Button, FaqItem, Icon, SectionHead, Slot, Tick } from "@/components/ui";
import { LINE_URL, TUTOR_NAME } from "@/lib/content";
import { getCopy } from "@/lib/site-texts";

export const metadata = { title: `รู้จัก${TUTOR_NAME} · PIPOL TUTOR` };

const CREDS = [
  ["school", "จภ. ปทุมธานี", "ศิษย์เก่า เข้าเรียน ม.1 ปี 2560"],
  ["engineering", "วิศวกรรมศาสตร์", "มหาวิทยาลัยเกษตรศาสตร์"],
  ["edit_document", "เขียนข้อสอบเอง", "คลังข้อสอบเสมือนจริง 100 ข้อ"],
  ["diversity_3", "รับ 40 คน / รุ่น", "เพื่อให้ตอบคำถามได้ทั่วถึง"],
];

const WHY = [
  {
    n: "1",
    flip: false,
    tint: "from-brand-50 to-brand-100",
    icon: "record_voice_over",
    slotTitle: `รูป${TUTOR_NAME}กำลังสอนหน้าห้อง`,
    slotNote: "แนวนอน 4:3 · เห็นกระดานและนักเรียนในเฟรม",
    h: "พี่สอนเองทุกคาบ ไม่ส่งต่อให้ผู้ช่วย",
    p: "คนที่น้องเห็นในคลิปแนะนำ คือคนเดียวกับที่ยืนสอนจริงทุกสัปดาห์ ตรวจการบ้านเอง และตอบคำถามในกลุ่มเอง พี่เลยจำได้ว่าน้องคนไหนติดตรงไหน โดยไม่ต้องเปิดดูประวัติ",
    t: ["สอนสด 24 ครั้ง ครบทั้ง 5 วิชาตามแนวข้อสอบ จภ.", "มีคลิปย้อนหลังให้ดูซ้ำได้ไม่จำกัดจนถึงวันสอบ", "เอกสารประกอบการเรียนแบบพิมพ์ ส่งถึงบ้าน"],
  },
  {
    n: "2",
    flip: true,
    tint: "from-teal-50 to-[#CFF1EB]",
    icon: "devices",
    slotTitle: "ภาพหน้าจอระบบทำข้อสอบ",
    slotNote: "แนวนอน 4:3 · ถ่ายจากจอจริง พร้อมธงสีรายข้อ",
    h: "วัดผลเป็นตัวเลขทุกสัปดาห์ ไม่ต้องเดาว่าพร้อมหรือยัง",
    p: "น้องทำข้อสอบเสมือนจริง 100 ข้อบนเว็บ จับเวลาเหมือนห้องสอบจริง ปักธงข้อที่ไม่มั่นใจไว้กลับมาทบทวนได้ ระบบตรวจให้ทันทีแล้วสรุปว่าบทไหนยังพลาดซ้ำ",
    t: ["ตรวจคำตอบบนเซิร์ฟเวอร์ เฉลยไม่หลุดออกมาที่เครื่องน้อง", "คำตอบถูกบันทึกอัตโนมัติ ทำค้างไว้แล้วกลับมาทำต่อได้", "รายงานคะแนนรายบท ผู้ปกครองดูได้ด้วย"],
  },
  {
    n: "3",
    flip: false,
    tint: "from-accent-50 to-[#FFDCCC]",
    icon: "forum",
    slotTitle: "รูปหมู่นักเรียนรุ่นที่ผ่านมา",
    slotNote: "แนวนอน 4:3 · ขออนุญาตผู้ปกครองก่อนใช้ภาพเด็ก",
    h: "กลุ่ม LINE ส่วนตัว ถามได้จนถึงวันสอบ",
    p: "ชำระเงินเสร็จ ระบบเปิดสิทธิ์และส่งลิงก์เข้ากลุ่มให้อัตโนมัติ ในกลุ่มพี่ตอบคำถามเองทุกข้อ ส่วนใหญ่ได้คำตอบภายในคืนเดียว และมีสรุปสิ่งที่ต้องอ่านให้ทุกวันอาทิตย์",
    t: ["ถ่ายรูปโจทย์ที่ติดส่งเข้ากลุ่มได้เลย", "แจ้งข่าวการรับสมัครและกำหนดการสอบให้ตลอด", "ผู้ปกครองเข้ากลุ่มดูได้ ไม่มีอะไรปิดบัง"],
  },
];

const STEPS: [string, string, string, boolean][] = [
  ["2560", "สอบติด จภ.", "เข้าเรียน ม.1 สายวิทย์–คณิต ที่ จภ. ปทุมธานี", false],
  ["2562", "เริ่มติวรุ่นน้อง", "ติวให้รุ่นน้องในโรงเรียนช่วงเย็น ไม่คิดค่าใช้จ่าย", false],
  ["2563", "เปิดคอร์สรุ่นแรก", "นักเรียน 12 คน สอบติด 8 คน สอนที่บ้านตัวเอง", false],
  ["2566", "ทำคลังข้อสอบเอง", "เขียนข้อสอบเสมือนจริงชุดแรก 100 ข้อจากข้อผิดที่เจอซ้ำ", false],
  ["2568", "ย้ายขึ้นออนไลน์", "ตรวจอัตโนมัติ วิเคราะห์รายบท เปิดรับสมัครออนไลน์", true],
];


const FAQ: [string, string][] = [
  [`${TUTOR_NAME}สอนเองจริงไหม หรือมีผู้ช่วยสอนแทน`, "สอนเองทุกคาบครับ ทั้งสอนสด ตรวจงาน และตอบคำถามในกลุ่ม LINE ไม่มีผู้ช่วยสอนแทน นี่คือเหตุผลที่รับได้แค่ 40 คนต่อรุ่น"],
  ["ถ้าเรียนไม่ทัน หรือติดธุระวันที่สอนสด ทำอย่างไร", "ทุกคาบมีคลิปย้อนหลังให้ดูซ้ำได้ไม่จำกัดจนถึงวันสอบ และถามค้างไว้ในกลุ่มได้ตลอด ไม่มีการตัดสิทธิ์ถ้าเข้าเรียนสดไม่ครบ"],
  ["ผู้ปกครองดูความคืบหน้าของลูกได้ไหม", "ได้ครับ ทุกครั้งที่น้องทำข้อสอบ ระบบจะสรุปคะแนนรายบทและเวลาเฉลี่ยต่อข้อ ผู้ปกครองเข้าดูได้จากบัญชีเดียวกัน"],
  ["จ่ายเงินแล้วเริ่มเรียนได้เลยไหม", "ได้ทันทีครับ เมื่อชำระเงินสำเร็จ ระบบจะเปิดสิทธิ์เข้าเรียนและส่งลิงก์เข้ากลุ่ม LINE ให้อัตโนมัติ ไม่ต้องรอแอดมินยืนยัน"],
];

export default async function AboutPage() {
  const c = await getCopy();
  const lineUrl = c.t("brand.line_url", LINE_URL);
  const tutor = c.t("brand.tutor_name", TUTOR_NAME);
  const creds = c.rows("about.creds", CREDS.map(([, t, s]) => [t, s]));
  const why = WHY.map((d) => ({
    ...d,
    h: c.t(`about.why_${d.n}_title`, d.h),
    p: c.t(`about.why_${d.n}_body`, d.p),
    t: c.lines(`about.why_${d.n}_points`, d.t),
  }));
  const stepRows = c.rows("about.steps", STEPS.map(([y, t, d]) => [y, t, d]));
  const steps = stepRows.map(([year, title = "", desc = ""], i) => [year, title, desc, i === stepRows.length - 1] as const);
  const faq = c.rows("about.faq", FAQ.map(([q, a]) => [q, a]));
  return (
    <>
      <SiteHeader current="about" />
      <main className="flex-1">
        <Band className="pb-14 pt-8 md:pb-20 md:pt-14">
          <div className="flex flex-col gap-9 lg:flex-row lg:items-center lg:gap-[58px]">
            <HeroCopy
              pill={c.t("about.hero_pill", "ผู้สอนคนเดียว ดูแลเองทุกรุ่น")}
              pillIcon="verified"
              title={
                <>
                  {c.t("about.hero_title_1", "สวัสดีครับ พี่ชื่อ “ที”")}
                  <br />
                  {c.t("about.hero_title_2", "ติวเตอร์ที่เคยสอบเข้า จภ. ด้วยตัวเอง")}
                </>
              }
              lede={c.t("about.hero_lede", "พี่สอนเตรียมสอบเข้า ม.1 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัยมา 6 ปี ดูแลนักเรียนมาแล้วกว่า 120 คน ทุกคอร์สพี่สอนเอง ตรวจงานเอง และตอบคำถามในกลุ่มเอง ไม่มีการส่งต่อให้ผู้ช่วย")}
              ctas={
                <>
                  <Button href="/courses" icon="school">{c.t("about.hero_cta_primary", `ดูคอร์สของ${TUTOR_NAME}`)}</Button>
                  <Button href={lineUrl} kind="line" icon="chat_bubble">{c.t("about.hero_cta_secondary", "ทักไลน์ถามก่อนได้")}</Button>
                </>
              }
              chips={c.rows("home.hero_chips", DEFAULT_HERO_CHIPS)}
              footnote={c.t("home.hero_footnote", DEFAULT_HERO_FOOTNOTE)}
            />
            <Portrait />
          </div>
        </Band>

        <Band tone="brand" className="py-8 md:py-[38px]">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-9">
            {creds.slice(0, CREDS.length).map(([title, sub = ""], i) => (
              <div key={title} className="flex items-start gap-3.5">
                <Icon name={CREDS[i][0]} size={27} fill className="mt-1 text-[#9DB2FF]" />
                <div>
                  <p className="font-display text-[21px] font-medium leading-[1.26] text-white">{title}</p>
                  <p className="text-[14px] text-[#BFCCFF]">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Band>

        <Band className="pb-10 pt-14 md:pt-[76px]">
          <div className="flex flex-col gap-11">
            <SectionHead
              title={c.t("about.why_title", `ทำไมผู้ปกครองถึงเลือกให้ลูกเรียนกับ${tutor}`)}
              sub={c.t("about.why_sub", "สามอย่างที่พี่ทำต่างจากคอร์สติวทั่วไป และเป็นเหตุผลที่นักเรียนส่วนใหญ่มาจากการบอกต่อ")}
            />
            {why.map((d) => (
              <div key={d.n} className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-14 ${d.flip ? "lg:flex-row-reverse" : ""}`}>
                <div className="relative w-full lg:w-[600px] lg:shrink-0">
                  <SiteImage slot={`about_why_${d.n}`} ratio="4 / 3" className="shadow-m">
                    <Slot icon={d.icon} title={d.slotTitle} note={d.slotNote} tint={d.tint} className="shadow-m" />
                  </SiteImage>
                  <span className="absolute -left-2.5 -top-3.5 flex size-[50px] items-center justify-center rounded-[17px] bg-accent font-display text-[20px] font-semibold text-on-fill shadow-m">
                    {d.n}
                  </span>
                </div>
                <div className="flex flex-col gap-[13px]">
                  <h3 className="text-[24px] font-semibold md:text-[27px]">{d.h}</h3>
                  <p className="text-[16px] text-ink2">{d.p}</p>
                  <ul className="flex flex-col gap-2.5">
                    {d.t.map((t) => (
                      <Tick key={t}>{t}</Tick>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Band>

        <Band tone="card" className="pb-10 pt-14 md:pt-[76px]">
          <div className="flex flex-col items-center gap-10">
            <SectionHead center title={c.t("about.steps_title", "เส้นทางกว่าจะมาเป็นคอร์สนี้")} sub={c.t("about.steps_sub", "ทุกรุ่นที่ผ่านมาเปลี่ยนเนื้อหาและชุดข้อสอบไปทีละนิด จนมาเป็นรูปแบบปัจจุบัน")} />
            <ol className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
              {steps.map(([year, title, desc, now]) => (
                <li key={year} className="flex flex-col gap-3.5">
                  <span
                    className={`flex size-[52px] items-center justify-center rounded-full font-display text-[13.5px] font-medium ${
                      now ? "bg-brand text-on-fill" : "border-[3px] border-border-strong bg-card text-ink2"
                    }`}
                  >
                    {year}
                  </span>
                  <p className="text-[17px] font-medium">{title}</p>
                  <p className="text-[14.5px] text-ink2">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </Band>


        <Band id="faq" tone="card" className="pb-10 pt-14 md:pt-[76px]">
          <div className="flex flex-col items-center gap-8">
            <SectionHead center title={c.t("about.faq_title", "คำถามที่ผู้ปกครองถามบ่อย")} />
            <div className="flex w-full max-w-[900px] flex-col gap-[11px]">
              {faq.map(([q, a = ""], i) => (
                <FaqItem key={q} q={q} a={a} open={i === 0} />
              ))}
            </div>
          </div>
        </Band>

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
