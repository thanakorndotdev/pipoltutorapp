import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Bar, Button, Card, Icon, Note, StatCard, Tick } from "@/components/ui";
import { fetchMyAttempt, fetchMyReview } from "@/lib/attempts";
import { TUTOR_NAME } from "@/lib/content";
import { SUBJECT_META } from "@/lib/exam";

export const metadata = { title: "สรุปคะแนน · PIPOL TUTOR" };

const EMPTY = "—";

function perQuestion(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} วินาที`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m} นาที ${s} วินาที` : `${m} นาที`;
}

/**
 * The report for one graded attempt (`?attempt=<id>`): score and the
 * per-topic breakdown the server wrote at grading time, plus explanations
 * for the questions missed. Everything comes from the backend; the page
 * never sees the key. Without a finished attempt it shows the empty state.
 */
export default async function ScorePage({ searchParams }: { searchParams: Promise<{ attempt?: string | string[] }> }) {
  const raw = (await searchParams).attempt;
  const id = typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const attempt = id ? await fetchMyAttempt(id) : null;
  const graded = attempt && attempt.status !== "in_progress" ? attempt : null;
  const review = graded ? await fetchMyReview(graded.id) : null;

  const total = review?.length ?? 0;
  const correct = graded?.score ?? 0;
  const unanswered = review?.filter((q) => !q.selectedChoice).length ?? 0;
  const wrong = total - correct - unanswered;
  const usedSeconds =
    graded?.submittedAt ? (new Date(graded.submittedAt).getTime() - new Date(graded.startedAt).getTime()) / 1000 : 0;
  const topics = Object.entries(graded?.topicBreakdown ?? {})
    .map(([topic, t]) => ({ topic, ...t, pct: t.total ? t.correct / t.total : 0 }))
    .sort((a, b) => a.pct - b.pct);
  const missed = review?.filter((q) => !q.isCorrect) ?? [];

  return (
    <>
      <SiteHeader current="exam" app />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px]">
          <div className="flex flex-col gap-[26px]">
            <section className="bg-brand-grad flex flex-col gap-6 rounded-[28px] p-6 shadow-l md:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-11">
              <div className="flex flex-col gap-3.5">
                <h1 className="text-[26px] font-semibold text-white md:text-[32px]">{graded ? `สรุปผล ${graded.title}` : "สรุปผลชุดข้อสอบเสมือนจริง"}</h1>
                <p className="text-[16px] text-on-grad-soft">
                  {graded
                    ? graded.status === "expired"
                      ? "หมดเวลา ระบบส่งคำตอบให้อัตโนมัติ และตรวจบนเซิร์ฟเวอร์เรียบร้อยแล้ว"
                      : "ตรวจคำตอบบนเซิร์ฟเวอร์เรียบร้อยแล้ว ดูรายบทด้านล่างว่าควรเก็บบทไหนก่อน"
                    : attempt
                      ? "ชุดนี้ยังทำไม่เสร็จ กลับไปทำต่อได้เลย คำตอบที่ตอบไว้ยังอยู่ครบ"
                      : "ยังไม่มีผลคะแนน — ทำข้อสอบชุดแรกให้เสร็จ แล้วรายงานรายบทจะขึ้นที่นี่ทันที"}
                </p>
                {attempt && !graded ? (
                  <div>
                    <Button href={`/exam/${attempt.slug}`} kind="brand" icon="play_arrow">ทำต่อ</Button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-center gap-1.5 self-start rounded-[24px] border border-white/20 bg-white/12 px-[34px] py-6 lg:self-auto">
                <span className="tabular font-display text-[64px] font-semibold leading-[1.05] text-white">{graded ? correct : EMPTY}</span>
                <span className="whitespace-nowrap text-[14px] text-on-grad-soft">คะแนน จาก {graded ? total : 100}</span>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              <StatCard icon="check_circle" tileClass="bg-green-50 text-green" value={graded ? `${correct} ข้อ` : EMPTY} label="ตอบถูก" />
              <StatCard icon="cancel" tileClass="bg-red-50 text-red" value={graded && review ? `${wrong} ข้อ` : EMPTY} label="ตอบผิด" />
              <StatCard icon="help" tileClass="bg-amber-50 text-amber-icon" value={graded && review ? `${unanswered} ข้อ` : EMPTY} label="ไม่ได้ตอบ" />
              <StatCard icon="timer" tileClass="bg-brand-50 text-brand" value={graded && total ? perQuestion(usedSeconds / total) : EMPTY} label="เวลาเฉลี่ยต่อข้อ" />
            </div>

            <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">
              <div className="flex min-w-0 flex-1 flex-col gap-7">
                <Card as="section" className="p-[26px]">
                  <h2 className="text-[20px] font-semibold">คะแนนรายบท</h2>
                  {topics.length ? (
                    <ul className="mt-4 flex flex-col gap-4">
                      {topics.map((t) => (
                        <li key={t.topic} className="flex flex-col gap-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-display text-[16px] font-medium">{t.topic}</span>
                            <span className="tabular text-[14.5px] text-ink2">{t.correct}/{t.total}</span>
                          </div>
                          <Bar pct={t.pct} colorClass={t.pct >= 0.7 ? "bg-green" : t.pct >= 0.4 ? "bg-amber-icon" : "bg-red"} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded-[18px] bg-page px-6 py-10 text-center">
                      <Icon name="insights" size={36} className="text-ink3" />
                      <p className="font-display text-[16px] font-medium text-ink2">ยังไม่มีข้อมูลรายบท</p>
                      <p className="text-[14px] text-ink3">เมื่อทำข้อสอบเสร็จ ระบบจะแยกคะแนนให้ครบทั้ง 5 วิชา</p>
                    </div>
                  )}
                </Card>

                {missed.length ? (
                  <Card as="section" className="p-[26px]">
                    <h2 className="text-[20px] font-semibold">ข้อที่ควรทบทวน</h2>
                    <div className="mt-4 flex flex-col gap-3">
                      {missed.map((q) => (
                        <details key={q.id} className="group rounded-[18px] border border-border bg-card p-4">
                          <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
                            <Icon name={q.selectedChoice ? "cancel" : "help"} size={20} fill className={`mt-1 ${q.selectedChoice ? "text-red" : "text-amber-icon"}`} />
                            <span className="flex-1">
                              <span className="block text-[13px] text-ink3">ข้อ {q.position} · {SUBJECT_META[q.subject].label} · {q.topic}</span>
                              <span className="block text-[15.5px]">{q.prompt}</span>
                            </span>
                            <Icon name="expand_more" size={22} className="mt-1 text-ink3 group-open:rotate-180" />
                          </summary>
                          <div className="mt-3 flex flex-col gap-2 pl-8 text-[14.5px] text-ink2">
                            <p>น้องตอบ: {q.selectedChoice ? `${q.selectedChoice}. ${q.choices.find((c) => c.key === q.selectedChoice)?.text ?? ""}` : "ไม่ได้ตอบ"}</p>
                            {q.explanation ? <p className="rounded-[12px] bg-brand-50 px-3 py-2">{q.explanation}</p> : null}
                          </div>
                        </details>
                      ))}
                    </div>
                  </Card>
                ) : null}
              </div>

              <Card as="aside" lifted className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
                <h2 className="text-[19px] font-semibold">{TUTOR_NAME}แนะนำให้ทำต่อ</h2>
                <ul className="flex flex-col gap-2.5">
                  {topics.length ? (
                    topics.slice(0, 3).map((t) => (
                      <Tick key={t.topic} icon="menu_book" iconClass="text-brand">ทบทวนบท {t.topic} ({t.correct}/{t.total})</Tick>
                    ))
                  ) : (
                    <Tick icon="quiz" iconClass="text-brand">ทำข้อสอบเสมือนจริงชุดแรกให้ครบ 100 ข้อ</Tick>
                  )}
                  <Tick icon="flag" iconClass="text-accent">ข้อไหนไม่มั่นใจ ปักธงไว้ก่อน แล้วค่อยกลับมาดู</Tick>
                </ul>
                <Button href="/exam" kind="brand" icon="play_arrow" className="w-full">{graded ? "ทำชุดต่อไป" : "เริ่มทำข้อสอบ"}</Button>
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
