import Link from "next/link";
import { notFound } from "next/navigation";

import { CertificateSheet } from "@/components/certificate-sheet";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Band, Button, Icon, Note } from "@/components/ui";
import { certificateFileUrl, fetchMyCertificates, type Certificate } from "@/lib/certificates";
import { formatThaiDate, formatThaiDateTime } from "@/lib/format";

export const metadata = { title: "เกียรติบัตร · pipoltutor" };

const STATUS: Record<Certificate["status"], { label: string; cls: string }> = {
  valid: { label: "ใช้ได้", cls: "bg-green-50 text-green" },
  pending: { label: "กำลังสร้าง", cls: "bg-amber-50 text-amber-ink" },
  previous_valid: { label: "ฉบับก่อนหน้า (ยังตรวจสอบได้)", cls: "bg-brand-50 text-brand-dark" },
  revoked: { label: "ถูกเพิกถอน", cls: "bg-red-50 text-red" },
  superseded: { label: "ถูกแทนที่แล้ว", cls: "bg-red-50 text-red" },
};

const linkBtn = "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-full px-[26px] py-4 font-display text-[16px] font-medium leading-[1.3]";

/**
 * One certificate of the signed-in student, with the other certificates of
 * the same pack underneath (one per attempt, CERT-03). The list comes from
 * the backend already scoped to the session user, so another student's id
 * simply is not in it.
 */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = await fetchMyCertificates();
  const cert = all.find((c) => c.id === id);
  if (!cert) notFound();
  const usable = cert.status === "valid" || cert.status === "previous_valid";
  const siblings = all.filter((c) => c.packId === cert.packId && c.id !== cert.id);
  const current = all.find((c) => c.attemptId === cert.attemptId && c.status === "valid");

  return (
    <>
      <SiteHeader current="home" app />
      <main className="flex-1">
        <Band className="pb-14 pt-8 md:pb-[72px] md:pt-9">
          <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-ink3">
                <Link href="/dashboard#certificates" className="hover:text-brand">เมนูหลัก</Link> · เกียรติบัตร
              </p>
              <h1 className="text-[28px] font-semibold md:text-[34px]" style={{ textWrap: "balance" }}>
                เกียรติบัตร {cert.packTitle}
              </h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-ink2">
                <span className={`rounded-full px-3 py-1 text-[13px] ${STATUS[cert.status].cls}`}>{STATUS[cert.status].label}</span>
                <span>เลขที่ {cert.serial}</span>
                <span>สอบครั้งที่ {cert.attemptNo}</span>
                <span>ออกเมื่อ {formatThaiDate(cert.issuedAt)}</span>
              </p>
            </div>

            {usable || cert.status === "pending" ? (
              <CertificateSheet id={cert.id} status={cert.status} alt={`เกียรติบัตรของ ${cert.recipientName}`} className="rounded-[18px] border border-border shadow-m" />
            ) : (
              <Note icon="block" className="bg-red-50" iconClass="text-red">
                เกียรติบัตรฉบับนี้ถูกเพิกถอนแล้ว{" "}
                {current ? (
                  <Link href={`/dashboard/certificate/${current.id}`} className="font-medium text-brand underline underline-offset-2">เปิดฉบับล่าสุด</Link>
                ) : (
                  "ไม่สามารถดาวน์โหลดได้"
                )}
              </Note>
            )}

            {usable ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href={certificateFileUrl(cert.id, "png", true)} className={`${linkBtn} bg-brand text-on-fill shadow-m`}>
                  <Icon name="image" size={20} />
                  ดาวน์โหลดรูป (PNG)
                </a>
                <a href={certificateFileUrl(cert.id, "pdf", true)} className={`${linkBtn} border-[1.5px] border-border-strong bg-card text-ink`}>
                  <Icon name="picture_as_pdf" size={20} />
                  ดาวน์โหลด PDF
                </a>
                <Link href={`/cert/${cert.publicId}`} className={`${linkBtn} border-[1.5px] border-border-strong bg-card text-ink`}>
                  <Icon name="verified" size={20} />
                  หน้าตรวจสอบ
                </Link>
              </div>
            ) : null}
            {usable ? <Note icon="qr_code_2">สแกน QR บนเกียรติบัตรเพื่อตรวจสอบว่าเป็นใบจริง ผู้ตรวจจะไม่เห็นคะแนนหรืออีเมลของน้อง</Note> : null}

            {siblings.length ? (
              <section className="flex flex-col gap-3 border-t border-border pt-6">
                <h2 className="text-[19px] font-semibold">เกียรติบัตรอื่นของชุดนี้</h2>
                <ul className="flex flex-col divide-y divide-border rounded-[20px] border border-border bg-card px-4">
                  {siblings.map((c) => (
                    <li key={c.id}>
                      <Link href={`/dashboard/certificate/${c.id}`} className="flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-1 py-3">
                        <span className="font-display text-[15.5px] font-medium">ครั้งที่ {c.attemptNo}</span>
                        <span className="text-[13.5px] text-ink3">{c.serial} · ส่ง {c.submittedAt ? formatThaiDateTime(c.submittedAt) : "—"}</span>
                        <span className={`ml-auto rounded-full px-3 py-1 text-[13px] ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                        <Icon name="arrow_forward" size={18} className="text-brand" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div>
              <Button href="/dashboard#certificates" kind="ghost" icon="arrow_back">กลับเมนูหลัก</Button>
            </div>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
