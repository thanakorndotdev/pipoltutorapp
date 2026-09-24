import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Button, MenuCard, StatCard } from "@/components/ui";
import { fetchExamSettings } from "@/lib/api";
import { LINE_URL, TUTOR_NAME } from "@/lib/content";
import { getCopy } from "@/lib/site-texts";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "เมนูหลัก · PIPOL TUTOR" };

const EMPTY = "—";

/**
 * Days-to-exam comes from exam_settings. Everything about the student
 * (name, progress, scores) stays empty until attempts are wired — no
 * invented numbers. "ทำข้อสอบ" leads to /exam, which picks a pack and,
 * when it is locked, the course that unlocks it.
 */
export default async function DashboardPage() {
  const c = await getCopy();
  const user = await getSessionUser();
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || user?.email;
  const tutor = c.t("brand.tutor_name", TUTOR_NAME);
  const lineUrl = c.t("brand.line_url", LINE_URL);
  let daysLeft: number | null = null;
  try {
    daysLeft = (await fetchExamSettings()).daysLeft;
  } catch (error) {
    console.error("exam settings unavailable on dashboard:", error);
  }
  const daysLabel = daysLeft === null ? EMPTY : daysLeft <= 0 ? "ถึงวันสอบแล้ว" : `${daysLeft} วัน`;
  const greetingSub =
    daysLeft === null
      ? "ยังไม่มีข้อมูลความคืบหน้า เริ่มทำข้อสอบชุดแรกได้เลย"
      : daysLeft <= 0
        ? "ถึงวันสอบแล้ว — ขอให้โชคดี"
        : `เหลืออีก ${daysLeft} วันก่อนสอบ — ยังไม่มีข้อมูลความคืบหน้า เริ่มทำข้อสอบชุดแรกได้เลย`;

  return (
    <>
      <SiteHeader current="home" app />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px]">
          <div className="flex flex-col gap-7">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-[28px] font-semibold md:text-[32px]">{firstName ? `สวัสดี ${firstName}` : "สวัสดี"}</h1>
                <p className="text-[16px] text-ink2">{greetingSub}</p>
              </div>
              <Button href="/exam" icon="play_arrow">เริ่มทำข้อสอบ</Button>
            </header>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              <StatCard icon="assignment_turned_in" tileClass="bg-brand-50 text-brand" value={EMPTY} label="ข้อที่ทำไปแล้ว" />
              <StatCard icon="flag" tileClass="bg-red-50 text-red" value={EMPTY} label="ปักธงไว้ทบทวน" />
              <StatCard icon="trending_up" tileClass="bg-green-50 text-green" value={EMPTY} label="คะแนนเฉลี่ยล่าสุด" />
              <StatCard icon="schedule" tileClass="bg-accent-50 text-accent-dark" value={daysLabel} label="เหลือถึงวันสอบ" />
            </div>

            <h2 className="text-[22px] font-semibold">เมนูทั้งหมด</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
              <MenuCard icon="play_lesson" tileClass="bg-brand-50 text-brand" title="คอร์สของฉัน" desc="ดูคลิปย้อนหลังและเอกสารประกอบ" meta="ยังไม่มีข้อมูลการเรียน" href="/courses/full-course" />
              <MenuCard icon="quiz" tileClass="bg-teal-50 text-teal" title="ทำข้อสอบ" desc="ชุดข้อสอบเสมือนจริง 100 ข้อ" meta="ยังไม่ได้เริ่มทำ" href="/exam" />
              <MenuCard icon="insights" tileClass="bg-accent-50 text-accent-dark" title="ผลคะแนนและวิเคราะห์" desc="สรุปคะแนนรายบทและจุดอ่อน" meta="ยังไม่มีผลคะแนน" href="/exam/result" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
              <MenuCard icon="shopping_bag" tileClass="bg-amber-50 text-amber-icon" title="ซื้อคอร์ส / ชุดข้อสอบ" desc="ดูรายการที่ยังไม่ได้ซื้อ" meta="ดูคอร์สและราคา" href="/courses" />
              <MenuCard icon="auto_awesome" tileClass="bg-mystic-50 text-mystic" title="ดูดวงแนวทางสอบ" desc="กรอกข้อมูลเพื่อดูคำทำนาย" meta="ดูรายละเอียด" href="/fortune" />
              <MenuCard icon="forum" tileClass="bg-green-50 text-green" title="กลุ่ม LINE" desc={`เข้ากลุ่มถาม${tutor}ได้ตลอด`} meta="เปิดใน LINE" href={lineUrl} />
            </div>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
