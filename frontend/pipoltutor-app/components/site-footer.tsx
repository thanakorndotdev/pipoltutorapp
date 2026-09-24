import Link from "next/link";

import { LINE_URL, TUTOR_NAME } from "@/lib/content";
import { getCopy, type Copy } from "@/lib/site-texts";
import { BrandMark } from "./site-header";
import { Band, Button } from "./ui";

function cols(tutor: string, lineUrl: string): { title: string; links: { label: string; href: string }[] }[] {
  return [
    {
      title: "เมนู",
      links: [
        { label: "หน้าแรก", href: "/" },
        { label: `รู้จัก${tutor}`, href: "/about" },
        { label: "คอร์สเรียน", href: "/courses" },
        { label: "คลังข้อสอบ", href: "/exam" },
        { label: "ดูดวง", href: "/fortune" },
      ],
    },
    {
      title: "ช่วยเหลือ",
      links: [
        { label: "วิธีสมัครและชำระเงิน", href: "/courses" },
        { label: "เข้ากลุ่ม LINE", href: lineUrl },
        { label: "คำถามที่พบบ่อย", href: "/about#faq" },
        { label: `ติดต่อ${tutor}`, href: lineUrl },
      ],
    },
    {
      title: "ข้อกำหนด",
      links: [
        { label: "เงื่อนไขการใช้งาน", href: "#" },
        { label: "นโยบายความเป็นส่วนตัว", href: "#" },
        { label: "นโยบายการคืนเงิน", href: "#" },
      ],
    },
  ];
}

function Legal({ c }: { c: Copy }) {
  return (
    <div className="flex flex-col gap-1.5 text-[13.5px] text-footer-ink md:flex-row md:justify-between md:gap-6">
      <span>{c.t("footer.copyright", "© 2568 PIPOL TUTOR — สงวนลิขสิทธิ์ทุกประการ")}</span>
      <span>{c.t("footer.legal_note", "ออกแบบสำหรับนักเรียนที่ตั้งใจสอบเข้า จภ.")}</span>
    </div>
  );
}

const DEFAULT_CLIENT_NOTE =
  "หมายเหตุสำหรับผู้ว่าจ้าง: ชื่อผู้สอน รูปภาพ ประวัติ ตัวเลขสถิติ คะแนน รีวิว และข้อความทั้งหมดเป็นเนื้อหาตัวอย่างเพื่อดูงานออกแบบ ต้องแทนที่ด้วยข้อมูลจริงก่อนเผยแพร่ และต้องขออนุญาตผู้ปกครองก่อนใช้ภาพหรือข้อความของนักเรียน";

export async function SiteFooter() {
  const c = await getCopy();
  const tutor = c.t("brand.tutor_name", TUTOR_NAME);
  const lineUrl = c.t("brand.line_url", LINE_URL);
  const clientNote = c.t("footer.client_note", DEFAULT_CLIENT_NOTE).trim();
  return (
    <footer className="w-full bg-footer px-5 pb-[26px] pt-14 md:px-10 lg:px-[72px]">
      <div className="mx-auto flex w-full max-w-[1296px] flex-col gap-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-11">
          <div className="flex flex-col gap-3.5 lg:flex-1">
            <BrandMark onDark />
            <p className="max-w-[320px] text-[14.5px] leading-[1.7] text-footer-ink">
              {c.t("footer.desc", `คอร์สติวเตรียมสอบเข้า ม.1 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย สอนโดย${TUTOR_NAME} ศิษย์เก่า จภ. โดยตรง`)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:flex-[2]">
            {cols(tutor, lineUrl).map((col) => (
              <div key={col.title} className="flex flex-col gap-1">
                <p className="mb-1.5 font-display text-[15px] font-medium text-white">{col.title}</p>
                {col.links.map((l) => (
                  <Link key={l.label} href={l.href} className="py-1 text-[14.5px] text-footer-ink hover:text-white">
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <hr className="border-footer-line" />
        <Legal c={c} />
        {clientNote ? (
          <p className="rounded-[14px] border border-footer-line px-[15px] py-[13px] text-[12.5px] leading-[1.75] text-footer-ink">{clientNote}</p>
        ) : null}
      </div>
    </footer>
  );
}

/** Text-only footer for focused screens (login, exam, fortune). */
export async function SlimFooter() {
  const c = await getCopy();
  return (
    <footer className="w-full bg-footer px-5 py-[26px] md:px-10 lg:px-[72px]">
      <div className="mx-auto w-full max-w-[1296px]">
        <Legal c={c} />
      </div>
    </footer>
  );
}

export async function CtaBand() {
  const c = await getCopy();
  const tutor = c.t("brand.tutor_name", TUTOR_NAME);
  return (
    <Band className="pb-16 pt-5 md:pb-[84px]">
      <div className="bg-brand-grad flex flex-col gap-6 rounded-[30px] p-[26px] shadow-l md:p-[34px] lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-[46px]">
        <div className="flex flex-col gap-[11px]">
          <h2 className="text-[26px] font-semibold text-white md:text-[32px]">{c.t("footer.cta_title", "เปิดรับสมัครแล้ว")}</h2>
          <p className="text-[16px] text-on-grad-soft">
            {c.t("footer.cta_sub", `ยังไม่แน่ใจว่าเหมาะกับลูกหรือเปล่า ทักไลน์มาคุยกับ${TUTOR_NAME}ก่อนได้ ไม่มีการตื๊อให้สมัคร`)}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button href="/courses" icon="shopping_bag">ดูคอร์สและราคา</Button>
          <Button href={c.t("brand.line_url", LINE_URL)} kind="line" icon="chat_bubble">ทักไลน์{tutor}</Button>
        </div>
      </div>
    </Band>
  );
}
