import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SlimFooter } from "@/components/site-footer";
import { Icon, Note } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { certificateFileUrl } from "@/lib/certificate-file";

export const metadata = {
  title: "ดาวน์โหลดไม่สำเร็จ · pipoltutor",
  robots: { index: false },
};

/**
 * Where GET /api/certificates/:id/file sends a browser (not a fetch) when it
 * cannot hand over the file. The reason comes from the backend redirect; the
 * page only explains it and offers the next step, so a hand-edited query
 * string can at worst show the wrong message.
 */
type Reason = "unauthorized" | "not_found" | "pending" | "revoked";

const COPY: Record<Reason, { status: number; icon: string; tone: string; title: string; body: string }> = {
  unauthorized: {
    status: 401,
    icon: "lock",
    tone: "bg-amber-50 text-amber-icon",
    title: "กรุณาเข้าสู่ระบบก่อนดาวน์โหลด",
    body: "เบราว์เซอร์นี้ยังไม่ได้เข้าสู่ระบบ เข้าสู่ระบบด้วยบัญชี Google ที่ใช้ทำข้อสอบ แล้วกดดาวน์โหลดอีกครั้ง",
  },
  not_found: {
    status: 404,
    icon: "person_search",
    tone: "bg-amber-50 text-amber-icon",
    title: "ไม่พบเกียรติบัตรในบัญชีนี้",
    body: "เกียรติบัตรนี้ไม่ได้อยู่ในบัญชี Google ที่เข้าสู่ระบบอยู่ตอนนี้ ลองเข้าสู่ระบบด้วยบัญชีที่ใช้ทำข้อสอบ",
  },
  pending: {
    status: 409,
    icon: "hourglass_top",
    tone: "bg-brand-50 text-brand",
    title: "กำลังสร้างเกียรติบัตร",
    body: "ระบบกำลังสร้างไฟล์ให้น้องอยู่ ใช้เวลาไม่นาน รอสักครู่แล้วกดดาวน์โหลดอีกครั้งได้เลย",
  },
  revoked: {
    status: 410,
    icon: "block",
    tone: "bg-red-50 text-red",
    title: "เกียรติบัตรฉบับนี้ใช้ไม่ได้แล้ว",
    body: "ฉบับนี้ถูกแทนที่หรือถูกเพิกถอนแล้ว เปิดหน้าเกียรติบัตรเพื่อดาวน์โหลดฉบับล่าสุด",
  },
};

const FALLBACK = {
  status: 0,
  icon: "error",
  tone: "bg-red-50 text-red",
  title: "ดาวน์โหลดไม่สำเร็จ",
  body: "เกิดข้อผิดพลาดระหว่างดาวน์โหลด ลองใหม่อีกครั้งจากหน้า Dashboard",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const btn =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-[26px] py-4 font-display text-[16px] font-medium leading-[1.3] transition-transform hover:-translate-y-px";
const primary = `${btn} bg-brand text-on-fill shadow-m`;
const ghost = `${btn} border-[1.5px] border-border-strong bg-card text-ink`;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function DownloadErrorPage({
  searchParams,
}: {
  searchParams: Promise<{
    reason?: string | string[];
    status?: string | string[];
    id?: string | string[];
    format?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const raw = one(sp.reason);
  const reason = raw && raw in COPY ? (raw as Reason) : null;
  const copy = reason ? COPY[reason] : FALLBACK;
  // The backend sends the status it would have answered a fetch with; fall back to the reason's own.
  const sent = Number(one(sp.status));
  const status = Number.isInteger(sent) && sent >= 400 && sent <= 599 ? sent : copy.status;
  const idRaw = one(sp.id);
  const id = idRaw && UUID.test(idRaw) ? idRaw : null;
  const format = one(sp.format) === "pdf" ? "pdf" : "png";
  const certPage = id ? `/dashboard/certificate/${id}` : "/dashboard";
  const user = reason === "not_found" ? await getSessionUser() : null;

  return (
    <>
      <SiteHeader current="home" app />
      <main className="flex flex-1 items-center justify-center bg-page px-5 py-14 md:px-10">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-5 rounded-[24px] border border-border bg-card px-5 py-9 text-center shadow-s md:px-9">
          <span className={`flex size-16 items-center justify-center rounded-full ${copy.tone}`}>
            <Icon name={copy.icon} size={32} fill />
          </span>
          {status ? (
            <span className="rounded-full bg-page px-3.5 py-1 font-display text-[14px] font-medium text-ink2">
              รหัสข้อผิดพลาด {status}
            </span>
          ) : null}
          <h1 className="text-[24px] font-semibold leading-[1.34] md:text-[26px]" style={{ textWrap: "balance" }}>
            {copy.title}
          </h1>
          <p className="text-[16px] leading-[1.75] text-ink2">{copy.body}</p>

          {user ? (
            <div className="flex w-full items-center gap-3.5 rounded-[18px] border border-border bg-page p-4 text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand">
                <Icon name="person" size={22} fill />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[13.5px] text-ink3">เข้าสู่ระบบอยู่ด้วย</span>
                <span className="truncate font-display text-[16px] font-medium">{user.email}</span>
              </span>
            </div>
          ) : null}

          <div className="flex w-full flex-col gap-3">
            {reason === "unauthorized" || reason === "not_found" ? (
              // Plain <a>: /api/ is the backend, not a Next route. Google always asks which account.
              // Back to the certificate page, not the file: safeNext refuses /api/ paths.
              <a href={`/api/auth/google?next=${encodeURIComponent(certPage)}`} className={primary}>
                <Icon name={reason === "unauthorized" ? "login" : "switch_account"} size={20} />
                {reason === "unauthorized" ? "เข้าสู่ระบบด้วย Google" : "เข้าสู่ระบบด้วยบัญชี Google อื่น"}
              </a>
            ) : reason === "pending" && id ? (
              <a href={certificateFileUrl(id, format, true)} className={primary}>
                <Icon name="refresh" size={20} />
                ลองดาวน์โหลดอีกครั้ง
              </a>
            ) : id ? (
              <Link href={certPage} className={primary}>
                <Icon name="workspace_premium" size={20} />
                เปิดหน้าเกียรติบัตร
              </Link>
            ) : null}
            <Link href="/dashboard" className={ghost}>
              <Icon name="dashboard" size={20} />
              ไปที่ Dashboard
            </Link>
          </div>

          {reason === "unauthorized" || reason === "not_found" ? (
            <Note icon="info" className="bg-brand-50 text-left">
              ถ้าน้องเข้าสู่ระบบจากในแอป IG หรือ LINE แล้วลิงก์ดาวน์โหลดเด้งมาเปิดใน Chrome
              สองที่นี้แยกการเข้าสู่ระบบกัน ให้เลือกบัญชี Google เดียวกับที่ใช้ในแอป
            </Note>
          ) : null}
        </div>
      </main>
      <SlimFooter />
    </>
  );
}
