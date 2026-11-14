import { FireCard } from "@/components/fire-card";
import { RankingCard } from "@/components/ranking-card";
import Link from "next/link";

import { CertificateSheet } from "@/components/certificate-sheet";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band, Button, Card, Icon, MenuCard, StatCard } from "@/components/ui";
import { fetchExamSettings } from "@/lib/api";
import { LINE_URL, TUTOR_NAME } from "@/lib/content";
import { getCopy } from "@/lib/site-texts";
import { getSessionUser } from "@/lib/auth";
import { fetchLineInvite } from "@/lib/orders";
import { fetchMyAttempts } from "@/lib/attempts";
import { fetchMyCertificates } from "@/lib/certificates";
import { fetchMyNotifications } from "@/lib/notifications";
import { formatThaiDate, formatThaiDateTime } from "@/lib/format";

export const metadata = { title: "เมนูหลัก · pipoltutor" };

const EMPTY = "—";

const STATUS = {
  in_progress: { label: "กำลังทำ", cls: "bg-amber-50 text-amber-ink" },
  submitted: { label: "ส่งแล้ว", cls: "bg-green-50 text-green" },
  expired: { label: "หมดเวลา ส่งอัตโนมัติ", cls: "bg-brand-50 text-brand-dark" },
} as const;

const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

/**
 * Days-to-exam comes from exam_settings; the exam history and the stat
 * cards come from the student's own attempts. Every attempt is listed on its
 * own, including ones an admin reset, so repeat attempts stay separate.
 * Each finished pack also earns a certificate carrying the student's name.
 */
export default async function DashboardPage() {
  const c = await getCopy();
  const user = await getSessionUser();
  const firstName = user?.nickname || user?.displayName?.trim().split(/\s+/)[0] || user?.email;
  const tutor = c.t("brand.tutor_name", TUTOR_NAME);
  // Buyers get the private group invite; everyone else the public chat link.
  const [lineInvite, history, allCertificates, notices] = await Promise.all([fetchLineInvite(), fetchMyAttempts(), fetchMyCertificates(), fetchMyNotifications()]);
  // One card per pack: the default attempt (best score). The others are on the certificate page.
  const certificates = allCertificates.filter((cert) => cert.isDefault);
  const otherCount = (packId: string) => allCertificates.filter((x) => x.packId === packId && !x.isDefault && (x.status === "valid" || x.status === "pending")).length;
  const finished = history.filter((a) => a.status !== "in_progress");
  const latest = finished[0];
  const lineUrl = lineInvite ?? c.t("brand.line_url", LINE_URL);
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
          <div className="mb-6"><FireCard/></div>
          <div className="flex flex-col gap-7">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-[28px] font-semibold md:text-[32px]">{firstName ? `สวัสดี ${firstName}` : "สวัสดี"}</h1>
                <p className="text-[16px] text-ink2">{greetingSub}</p>
              </div>
              <Button href="/exam" icon="play_arrow">เริ่มทำข้อสอบ</Button>
            </header>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              <StatCard icon="assignment_turned_in" tileClass="bg-brand-50 text-brand" value={finished.length ? `${finished.length} ครั้ง` : EMPTY} label="สอบไปแล้ว" />
              <StatCard icon="pending_actions" tileClass="bg-red-50 text-red" value={`${history.length - finished.length} ชุด`} label="กำลังทำค้างไว้" />
              <StatCard icon="trending_up" tileClass="bg-green-50 text-green" value={latest?.score != null ? `${pts(latest.score)}/${pts(latest.maxScore ?? 0)}` : EMPTY} label="คะแนนล่าสุด" />
              <StatCard icon="schedule" tileClass="bg-accent-50 text-accent-dark" value={daysLabel} label="เหลือถึงวันสอบ" />
            </div>

            <Card as="section" className="flex flex-col gap-4 p-5 md:p-6">
              <div id="history" className="flex scroll-mt-6 flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-semibold">ประวัติการสอบ</h2>
                <p className="text-[13.5px] text-ink3">คะแนนเบื้องต้น อัปเดตอัตโนมัติหากมีการตรวจใหม่</p>
              </div>
              {history.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[18px] bg-page px-6 py-10 text-center">
                  <Icon name="history" size={34} className="text-ink3" />
                  <p className="text-[15.5px] text-ink2">ยังไม่มีประวัติ ทำข้อสอบชุดแรกได้ที่หน้าข้อสอบ</p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {history.map((a) => {
                    const st = STATUS[a.status];
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[16px] font-medium">
                            {a.title} <span className="text-[13.5px] font-normal text-ink3">ครั้งที่ {a.attemptNo}</span>
                          </p>
                          {a.level || a.subjectLabel ? (
                            <p className="text-[13.5px] text-ink2">
                              {[a.level ? (a.level === "m1" ? "ม.1" : "ม.4") : null, a.subjectLabel]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          <p className="text-[13.5px] text-ink3">
                            เริ่ม {formatThaiDateTime(a.startedAt)}
                            {a.submittedAt ? ` · ส่ง ${formatThaiDateTime(a.submittedAt)}` : ""}
                            {a.resetAt ? " · รีเซ็ตสิทธิ์แล้ว" : ""}
                          </p>
                          <p className="text-[13.5px] text-ink3">
                            รหัสการส่ง <span className="tabular">{a.id.slice(0, 8).toUpperCase()}</span>
                          </p>
                        </div>
                        {a.status!=="in_progress" ? <RankingCard attemptId={a.id} compact/> : null}
                        <span className={`rounded-full px-3 py-1 text-[13px] ${st.cls}`}>{st.label}</span>
                        <span className="tabular w-[92px] text-right font-display text-[17px] font-semibold">
                          {a.score != null ? `${pts(a.score)}/${pts(a.maxScore ?? 0)}` : EMPTY}
                        </span>
                        <Button
                          href={a.status === "in_progress" ? `/exam/${a.slug}` : `/exam/result?attempt=${a.id}`}
                          kind="ghost"
                          size="sm"
                          icon={a.status === "in_progress" ? "play_arrow" : "insights"}
                        >
                          {a.status === "in_progress" ? "ทำต่อ" : "ดูผล"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card as="section" className="flex scroll-mt-6 flex-col gap-4 p-5 md:p-6">
              <div id="certificates" className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-semibold">เกียรติบัตรของฉัน</h2>
                <p className="text-[13.5px] text-ink3">
                  ชื่อบนเกียรติบัตรมาจาก{" "}
                  <Link href="/profile?next=/dashboard" className="text-brand underline-offset-2 hover:underline">ข้อมูลนักเรียน</Link>
                </p>
              </div>
              {certificates.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[18px] bg-page px-6 py-10 text-center">
                  <Icon name="workspace_premium" size={34} className="text-ink3" />
                  <p className="text-[15.5px] text-ink2">ส่งข้อสอบชุดที่มีเกียรติบัตร แล้วเกียรติบัตรที่มีชื่อน้องจะขึ้นที่นี่</p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {certificates.map((cert) => (
                    <li key={cert.id}>
                      <Link
                        href={`/dashboard/certificate/${cert.id}`}
                        className="group flex h-full flex-col gap-3 rounded-[22px] border border-border bg-page p-3 transition-transform hover:-translate-y-0.5"
                      >
                        <CertificateSheet id={cert.id} status={cert.status} alt={`เกียรติบัตรของ ${cert.recipientName} — ${cert.packTitle}`} className="rounded-[14px] border border-border shadow-s" />
                        <div className="flex items-end justify-between gap-3 px-1.5 pb-1">
                          <div className="min-w-0">
                            <p className="font-display text-[15.5px] font-medium leading-[1.4]">{cert.packTitle}</p>
                            <p className="text-[13px] text-ink3">
                              ครั้งที่ {cert.attemptNo} · {formatThaiDate(cert.issuedAt)}
                              {otherCount(cert.packId) ? ` · อีก ${otherCount(cert.packId)} ใบ` : ""}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 font-display text-[14px] font-medium text-brand">
                            เปิดดู <Icon name="arrow_forward" size={18} />
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card as="section" className="flex flex-col gap-4 p-5 md:p-6">
              <div id="notifications" className="flex scroll-mt-6 flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-semibold">การแจ้งเตือน</h2>
                <p className="text-[13.5px] text-ink3">คำตอบความคิดเห็นและเกียรติบัตรฉบับใหม่</p>
              </div>
              {notices.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[18px] bg-page px-6 py-10 text-center">
                  <Icon name="notifications" size={34} className="text-ink3" />
                  <p className="text-[15.5px] text-ink2">ยังไม่มีการแจ้งเตือน เมื่อมีคนตอบความคิดเห็นของน้องจะขึ้นที่นี่</p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {notices.map((n) => (
                    <li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[16px] font-medium leading-[1.4]">
                          {n.title}
                          {n.dismissedAt ? null : <span className="ml-2 rounded-full bg-accent-50 px-2.5 py-0.5 font-sans text-[13px] font-normal text-accent-dark">ใหม่</span>}
                        </p>
                        {n.body ? <p className="line-clamp-2 text-[14.5px] text-ink2">{n.body}</p> : null}
                        <p className="text-[13.5px] text-ink3">{formatThaiDateTime(n.createdAt)}</p>
                      </div>
                      {n.link?.startsWith("/") ? (
                        <Button href={n.link} kind="ghost" size="sm" icon="arrow_forward">เปิดดู</Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <h2 className="text-[22px] font-semibold">เมนูทั้งหมด</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
              <MenuCard icon="play_lesson" tileClass="bg-brand-50 text-brand" title="คอร์สของฉัน" desc="ดูคลิปย้อนหลังและเอกสารประกอบ" meta="ยังไม่มีข้อมูลการเรียน" href="/courses/full-course" />
              <MenuCard icon="quiz" tileClass="bg-teal-50 text-teal" title="ทำข้อสอบ" desc="ข้อสอบเสมือนจริง ทำฟรี" meta={history.length ? `ทำไปแล้ว ${history.length} ครั้ง` : "ยังไม่ได้เริ่มทำ"} href="/exam" />
              <MenuCard icon="badge" tileClass="bg-accent-50 text-accent-dark" title="ข้อมูลนักเรียน" desc="ชื่อ ชื่อเล่น และ จภ. ที่สมัคร" meta="แก้ไขข้อมูล" href="/profile?next=/dashboard" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
              <MenuCard icon="shopping_bag" tileClass="bg-amber-50 text-amber-icon" title="ซื้อคอร์ส" desc="ดูคอร์สติวที่ยังไม่ได้ซื้อ" meta="ดูคอร์สและราคา" href="/courses" />
              <MenuCard icon="auto_awesome" tileClass="bg-mystic-50 text-mystic" title="ดูดวงแนวทางสอบ" desc="กรอกข้อมูลเพื่อดูคำทำนาย" meta="ดูรายละเอียด" href="/fortune" />
              <MenuCard icon="forum" tileClass="bg-green-50 text-green" title={lineInvite ? "กลุ่ม LINE" : "LINE"} desc={lineInvite ? `เข้ากลุ่มถาม${tutor}ได้ตลอด` : `ทักถาม${tutor}ได้ก่อนสมัคร`} meta="เปิดใน LINE" href={lineUrl} />
            </div>
          </div>
        </Band>
      </main>
      <SiteFooter />

    </>
  );
}
