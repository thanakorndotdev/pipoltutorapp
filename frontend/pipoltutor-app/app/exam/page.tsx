import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Card, Icon, Note, Pill } from "@/components/ui";
import { fetchExamPacks, type ExamPack } from "@/lib/api";
import { getSessionUser, sessionHeaders } from "@/lib/auth";
import { attemptsLabel, minutes, packAction, windowLabel, type PackAction } from "@/lib/exam-state";

export const metadata = { title: "ข้อสอบ · PIPOL TUTOR" };

const ACTION: Record<PackAction, { label: string; icon: string; tone: string; live: boolean }> = {
  resume: { label: "ทำต่อ (เวลายังเดินอยู่)", icon: "play_arrow", tone: "bg-accent text-on-fill", live: true },
  start: { label: "อ่านคำชี้แจงและเริ่มทำ", icon: "description", tone: "bg-brand text-on-fill", live: true },
  used_up: { label: "ทำครบแล้ว ดูผลที่ประวัติ", icon: "history", tone: "bg-page text-ink2 border-[1.5px] border-border", live: false },
  upcoming: { label: "ยังไม่เปิดให้ทำ", icon: "schedule", tone: "bg-page text-ink3 border-[1.5px] border-border", live: false },
  closed: { label: "ปิดรับคำตอบแล้ว", icon: "lock_clock", tone: "bg-page text-ink3 border-[1.5px] border-border", live: false },
};

/**
 * Every published pack, free for any signed-in student. The proxy sends
 * signed-out visitors to Google login first; a student without a profile is
 * sent to fill it in before seeing the list.
 */
export default async function ExamPacksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/exam");
  if (!user.profileComplete) redirect("/profile?next=/exam");

  let packs: ExamPack[] = [];
  let unavailable = false;
  try {
    packs = await fetchExamPacks(await sessionHeaders());
  } catch (error) {
    console.error("exam packs unavailable:", error);
    unavailable = true;
  }

  return (
    <>
      <SiteHeader current="exam" app />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px] md:pt-12">
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-3.5">
              <div><Pill icon="quiz">ข้อสอบเสมือนจริง · ฟรี</Pill></div>
              <h1 className="text-[32px] font-semibold md:text-[42px]" style={{ textWrap: "balance" }}>
                สวัสดี น้อง{user.nickname} เลือกชุดข้อสอบได้เลย
              </h1>
              <p className="max-w-[760px] text-[17px] text-ink2 md:text-[18px]">
                ทำได้ฟรีทุกชุด เวลาเริ่มนับเมื่อกดเริ่มทำข้อสอบหลังอ่านคำชี้แจงเท่านั้น ส่งแล้วดูคะแนนย้อนหลังได้ที่{" "}
                <Link href="/dashboard" className="font-medium text-brand underline-offset-2 hover:underline">ประวัติการสอบ</Link>
              </p>
              <p className="text-[14.5px] text-ink3">
                ข้อมูลนักเรียน: {user.firstName} {user.lastName} ·{" "}
                <Link href="/profile?next=/exam" className="text-brand underline-offset-2 hover:underline">แก้ไข</Link>
              </p>
            </header>

            {unavailable ? (
              <Note icon="error" className="bg-red-50" iconClass="text-red">
                โหลดรายการชุดข้อสอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง
              </Note>
            ) : null}

            {!unavailable && packs.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 py-14 text-center">
                <Icon name="inventory_2" size={40} className="text-ink3" />
                <p className="text-[17px] text-ink2">ยังไม่มีชุดข้อสอบที่เปิดอยู่ กลับมาดูใหม่เร็ว ๆ นี้</p>
              </Card>
            ) : null}

            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
              {packs.map((p) => {
                const action = packAction(p);
                const a = ACTION[action];
                const window = windowLabel(p);
                return (
                  <li key={p.id}>
                    <Card className="flex h-full flex-col gap-4">
                      <div className="flex items-start gap-3.5">
                        <span className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${a.live ? "bg-teal-50 text-teal" : "bg-page text-ink3"}`}>
                          <Icon name="quiz" size={22} fill />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <h2 className="font-display text-[18px] font-medium leading-[1.4]">{p.title}</h2>
                          <p className="text-[14px] leading-[1.6] text-ink3">
                            {minutes(p.allowedSeconds)} · {attemptsLabel(p)}
                            {p.published ? "" : " · ซ่อนอยู่ (เห็นเฉพาะทีมงาน)"}
                          </p>
                          {window ? <p className="text-[14px] leading-[1.6] text-ink3">{window}</p> : null}
                        </div>
                      </div>
                      <Link
                        href={action === "used_up" ? "/dashboard" : `/exam/${encodeURIComponent(p.slug)}`}
                        className={`mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 font-display text-[16px] font-medium ${a.live ? "shadow-m transition-transform hover:-translate-y-px" : ""} ${a.tone}`}
                      >
                        <Icon name={a.icon} size={20} />{a.label}
                      </Link>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
