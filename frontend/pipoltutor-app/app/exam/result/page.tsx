import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Button, Card, Icon, Note, StatCard, Tick } from "@/components/ui";
import { TUTOR_NAME } from "@/lib/content";

export const metadata = { title: "สรุปคะแนน · PIPOL TUTOR" };

const EMPTY = "—";

/**
 * Empty state until attempts are wired: the real report is
 * attempts.topicBreakdown from the server (exam-engine-rules). No sample
 * scores are rendered here.
 */
export default function ScorePage() {
  return (
    <>
      <SiteHeader current="exam" app />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px]">
          <div className="flex flex-col gap-[26px]">
            <section className="bg-brand-grad flex flex-col gap-6 rounded-[28px] p-6 shadow-l md:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-11">
              <div className="flex flex-col gap-3.5">
                <h1 className="text-[26px] font-semibold text-white md:text-[32px]">สรุปผลชุดข้อสอบเสมือนจริง</h1>
                <p className="text-[16px] text-on-grad-soft">ยังไม่มีผลคะแนน — ทำข้อสอบชุดแรกให้เสร็จ แล้วรายงานรายบทจะขึ้นที่นี่ทันที</p>
              </div>
              <div className="flex flex-col items-center gap-1.5 self-start rounded-[24px] border border-white/20 bg-white/12 px-[34px] py-6 lg:self-auto">
                <span className="font-display text-[64px] font-semibold leading-[1.05] text-white">{EMPTY}</span>
                <span className="whitespace-nowrap text-[14px] text-on-grad-soft">คะแนน จาก 100</span>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              <StatCard icon="check_circle" tileClass="bg-green-50 text-green" value={EMPTY} label="ตอบถูก" />
              <StatCard icon="cancel" tileClass="bg-red-50 text-red" value={EMPTY} label="ตอบผิด" />
              <StatCard icon="help" tileClass="bg-amber-50 text-amber-icon" value={EMPTY} label="ไม่ได้ตอบ" />
              <StatCard icon="timer" tileClass="bg-brand-50 text-brand" value={EMPTY} label="เวลาเฉลี่ยต่อข้อ" />
            </div>

            <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">
              <Card as="section" className="min-w-0 flex-1 p-[26px]">
                <h2 className="text-[20px] font-semibold">คะแนนรายบท</h2>
                <div className="mt-4 flex flex-col items-center gap-2 rounded-[18px] bg-page px-6 py-10 text-center">
                  <Icon name="insights" size={36} className="text-ink3" />
                  <p className="font-display text-[16px] font-medium text-ink2">ยังไม่มีข้อมูลรายบท</p>
                  <p className="text-[14px] text-ink3">เมื่อทำข้อสอบเสร็จ ระบบจะแยกคะแนนให้ครบทั้ง 5 วิชา</p>
                </div>
              </Card>

              <Card as="aside" lifted className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
                <h2 className="text-[19px] font-semibold">{TUTOR_NAME}แนะนำให้ทำต่อ</h2>
                <ul className="flex flex-col gap-2.5">
                  <Tick icon="quiz" iconClass="text-brand">ทำข้อสอบเสมือนจริงชุดแรกให้ครบ 100 ข้อ</Tick>
                  <Tick icon="flag" iconClass="text-accent">ข้อไหนไม่มั่นใจ ปักธงไว้ก่อน แล้วค่อยกลับมาดู</Tick>
                </ul>
                <Button href="/exam" kind="brand" icon="play_arrow" className="w-full">เริ่มทำข้อสอบ</Button>
                <Note icon="forum">ถ้าดูเฉลยแล้วยังไม่เข้าใจ ถ่ายรูปข้อนั้นส่งเข้ากลุ่ม LINE ได้เลย</Note>
              </Card>
            </div>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
