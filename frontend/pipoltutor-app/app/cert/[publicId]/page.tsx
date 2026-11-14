import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SlimFooter } from "@/components/site-footer";
import { Band, Button, Card, Icon, Note } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { fetchMyAttemptForCertificate, fetchVerification, LEVEL_LABEL, type CertificateStatus } from "@/lib/certificates";
import { formatThaiDate } from "@/lib/format";
import { NameCheck } from "./name-check";

export const metadata = { title: "ตรวจสอบเกียรติบัตร · pipoltutor", robots: { index: false, follow: false } };

const STATE: Record<CertificateStatus | "not_found", { icon: string; tone: string; title: string; sub: string }> = {
  valid: { icon: "verified", tone: "bg-green-50 text-green", title: "เกียรติบัตรฉบับนี้เป็นของจริง และใช้ได้", sub: "ออกโดย pipoltutor และยังไม่ถูกเพิกถอน" },
  previous_valid: { icon: "verified", tone: "bg-brand-50 text-brand-dark", title: "เกียรติบัตรฉบับก่อนหน้า ยังใช้ได้", sub: "มีการปรับรูปแบบเกียรติบัตรภายหลัง ฉบับนี้ยังได้รับการรับรอง" },
  pending: { icon: "hourglass_top", tone: "bg-amber-50 text-amber-ink", title: "เกียรติบัตรฉบับนี้กำลังจัดทำ", sub: "ระบบยังสร้างไฟล์ไม่เสร็จ ลองตรวจสอบใหม่อีกครั้งในอีกสักครู่" },
  revoked: { icon: "block", tone: "bg-red-50 text-red", title: "เกียรติบัตรฉบับนี้ถูกเพิกถอนแล้ว", sub: "ไม่ใช่ฉบับที่ใช้ได้" },
  superseded: { icon: "block", tone: "bg-red-50 text-red", title: "เกียรติบัตรฉบับนี้ถูกแทนที่แล้ว", sub: "ไม่ใช่ฉบับที่ใช้ได้" },
  not_found: { icon: "help", tone: "bg-red-50 text-red", title: "ไม่พบเกียรติบัตรรหัสนี้", sub: "รหัสอาจไม่ถูกต้อง หรือไม่ได้ออกโดย pipoltutor" },
};

/**
 * Public verification page, the QR target (CERT-08/09/11). Anyone may open
 * it; it shows status and exam details only. "ดูผลสอบของฉัน" goes through
 * Google login and the backend's ownership check before any score appears.
 */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ mine?: string | string[] }>;
}) {
  const { publicId } = await params;
  const wantsMine = (await searchParams).mine === "1";
  const self = `/cert/${encodeURIComponent(publicId)}`;

  let denied: string | null = null;
  if (wantsMine) {
    if (!(await getSessionUser())) redirect(`/login?next=${encodeURIComponent(`${self}?mine=1`)}`);
    const mine = await fetchMyAttemptForCertificate(publicId);
    if ("attemptId" in mine) redirect(`/exam/result?attempt=${mine.attemptId}`);
    denied = mine.denied;
  }

  const v = await fetchVerification(publicId);
  const state = STATE[v?.status ?? "not_found"];
  const found = v && v.status !== "not_found" ? v : null;

  return (
    <>
      <SiteHeader current="home" />
      <main className="flex-1">
        <Band className="pb-14 pt-8 md:pb-[72px] md:pt-10">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
            <h1 className="text-[28px] font-semibold md:text-[34px]">ตรวจสอบเกียรติบัตร</h1>

            {denied ? (
              <Note icon="lock" className="bg-red-50" iconClass="text-red">
                {denied}
              </Note>
            ) : null}

            {v === null ? (
              <Note icon="error" className="bg-red-50" iconClass="text-red">
                ตรวจสอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง
              </Note>
            ) : (
              <Card lifted className="flex flex-col gap-5">
                <div className={`flex items-start gap-3.5 rounded-[18px] px-4 py-4 ${state.tone}`}>
                  <Icon name={state.icon} size={30} fill className="mt-0.5" />
                  <div>
                    <p className="font-display text-[19px] font-medium leading-[1.4]">{state.title}</p>
                    <p className="text-[14.5px] text-ink2">
                      {state.sub}
                      {found?.hasCurrent ? " · มีฉบับล่าสุดออกแทนแล้ว เจ้าของดาวน์โหลดได้จาก Dashboard" : ""}
                    </p>
                  </div>
                </div>

                {found ? (
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[15.5px] sm:grid-cols-2">
                    <div>
                      <dt className="text-[13.5px] text-ink3">เลขที่เกียรติบัตร</dt>
                      <dd className="tabular font-display font-medium">{found.serial}</dd>
                    </div>
                    <div>
                      <dt className="text-[13.5px] text-ink3">วันที่ออก</dt>
                      <dd>{formatThaiDate(found.issuedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[13.5px] text-ink3">ชุดข้อสอบ</dt>
                      <dd>{found.examTitle}</dd>
                    </div>
                    <div>
                      <dt className="text-[13.5px] text-ink3">ระดับ / วิชา</dt>
                      <dd>{[found.level ? LEVEL_LABEL[found.level] : null, found.subject].filter(Boolean).join(" · ") || "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[13.5px] text-ink3">ลายเซ็นดิจิทัลของผู้ออก</dt>
                      <dd className={`flex items-center gap-1.5 ${found.signatureValid ? "text-green" : "text-red"}`}>
                        <Icon name={found.signatureValid ? "lock" : "gpp_bad"} size={19} fill />
                        {found.signatureValid ? "ถูกต้อง ข้อมูลไม่ถูกแก้ไขหลังออกใบ" : found.status === "pending" ? "ยังไม่ได้ลงนาม" : "ตรวจไม่ผ่าน ข้อมูลของใบนี้ไม่ตรงกับที่ลงนามไว้"}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {found && found.status !== "pending" ? (
                  <>
                    <hr className="border-border" />
                    <NameCheck publicId={publicId} />
                    <hr className="border-border" />
                    <div className="flex flex-col gap-2.5">
                      <p className="text-[14.5px] text-ink2">เป็นเจ้าของเกียรติบัตรนี้? เข้าสู่ระบบด้วยบัญชี Google ที่ใช้ทำข้อสอบเพื่อดูผลสอบของตัวเอง</p>
                      <div>
                        <Button href={`${self}?mine=1`} kind="ghost" icon="insights">ดูผลสอบของฉัน</Button>
                      </div>
                    </div>
                  </>
                ) : null}
              </Card>
            )}

            <Note icon="info">
              หน้านี้ตรวจข้อมูลของเกียรติบัตร (เลขที่ ชื่อ ชุดข้อสอบ วันที่) กับลายเซ็นดิจิทัลที่เซิร์ฟเวอร์ของ pipoltutor ลงไว้ ไม่ได้ตรวจไฟล์รูปหรือ PDF ทีละจุด
              หากข้อความบนใบที่ได้รับไม่ตรงกับผลตรวจด้านบน ให้ถือผลตรวจในหน้านี้เป็นหลัก หน้านี้ไม่แสดงคะแนน อีเมล หรือข้อมูลส่วนตัวของผู้รับ
            </Note>
          </div>
        </Band>
      </main>
      <SlimFooter />
    </>
  );
}
