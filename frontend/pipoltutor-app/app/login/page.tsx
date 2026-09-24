import { BrandMark, SiteHeader } from "@/components/site-header";
import { SlimFooter } from "@/components/site-footer";
import { Button, Icon, Note, Tick } from "@/components/ui";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export const metadata = { title: "เข้าสู่ระบบ · PIPOL TUTOR" };

const FEATS: [string, string][] = [
  ["cloud_done", "คำตอบถูกบันทึกอัตโนมัติบนเซิร์ฟเวอร์"],
  ["lock", "เฉลยเก็บไว้ฝั่งเซิร์ฟเวอร์ ไม่ส่งมาที่เครื่องน้อง"],
  ["devices", "ทำต่อจากเครื่องไหนก็ได้ ทั้งมือถือและคอม"],
];

/** Reasons /api/auth/google/callback can send the visitor back here. */
const ERRORS: Record<string, string> = {
  not_configured:
    "ระบบยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Google — แจ้งผู้ดูแลระบบ",
  access_denied: "ยกเลิกการเข้าสู่ระบบแล้ว ลองใหม่ได้เมื่อพร้อม",
  email_unverified: "บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล",
  state_missing: "หน้าเข้าสู่ระบบหมดอายุ กรุณาลองใหม่อีกครั้ง",
  state_mismatch: "หน้าเข้าสู่ระบบหมดอายุ กรุณาลองใหม่อีกครั้ง",
};

/** `next` is where the proxy sent the visitor from (e.g. /fortune); only same-site paths are honoured. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const raw = sp.next;
  const next =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/dashboard";
  const fortune = next.startsWith("/fortune");
  const errorCode = typeof sp.error === "string" ? sp.error : undefined;
  const error = errorCode
    ? (ERRORS[errorCode] ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    : null;
  const user = await getSessionUser();
  const googleHref = `/api/auth/google?next=${encodeURIComponent(next)}`;
  return (
    <>
      <SiteHeader current="home" />
      <main className="flex flex-1 flex-col lg:min-h-[860px] lg:flex-row">
        <section className="bg-brand-grad flex flex-col justify-center gap-[22px] px-5 py-12 md:px-14 lg:w-[620px] lg:shrink-0">
          <BrandMark onDark />
          <h1
            className="text-[28px] font-semibold text-white md:text-[33px]"
            style={{ textWrap: "balance" }}
          >
            เข้าสู่ระบบเพื่อเริ่มทำข้อสอบ
            <br />
            และดูคะแนนของน้อง
          </h1>
          <p className="text-[16.5px] text-on-grad-soft">
            ระบบใช้บัญชี Google ในการยืนยันตัวตน
            เพื่อให้คำตอบและคะแนนของน้องถูกบันทึกไว้ต่อเนื่อง
            ไม่หายแม้เปลี่ยนเครื่อง
          </p>
          <ul className="flex flex-col gap-3.5">
            {FEATS.map(([icon, t]) => (
              <Tick
                key={t}
                icon={icon}
                iconClass="text-[#5EE0D0]"
                textClass="text-on-grad-soft"
              >
                {t}
              </Tick>
            ))}
          </ul>
        </section>

        <section className="flex flex-1 items-center justify-center bg-card px-5 py-14 md:px-14">
          {user ? (
            <SignedIn user={user} next={next} googleHref={googleHref} />
          ) : (
            <div className="flex w-full max-w-[440px] flex-col items-center gap-5">
              <h2 className="text-center text-[26px] font-semibold">
                {fortune ? "เข้าสู่ระบบก่อนดูดวง" : "ยินดีต้อนรับกลับมา"}
              </h2>
              {error ? <Note icon="error">{error}</Note> : null}
              {fortune ? (
                <Note icon="auto_awesome">
                  ดูดวงแนวทางการสอบใช้ได้เฉพาะบัญชีที่เข้าสู่ระบบแล้ว
                  เพื่อเก็บคำทำนายไว้ให้เปิดดูซ้ำได้
                </Note>
              ) : null}
              <p className="text-center text-[16px] text-ink2">
                เข้าสู่ระบบด้วยบัญชี Google ของน้อง
                <br />
                ไม่ต้องตั้งรหัสผ่านใหม่
              </p>
              {/* Google OAuth is not wired yet; this posts to the future auth route. */}
              <a
                href={googleHref}
                className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-border-strong bg-card px-6 py-[15px] font-display text-[16px] font-medium shadow-s"
              >
                <span
                  aria-hidden
                  className="size-[22px] rounded-full bg-[#EA4335]"
                />
                ดำเนินการต่อด้วย Google
              </a>
              <div className="flex w-full items-center gap-3.5 text-[13px] text-ink3">
                <hr className="flex-1 border-border" />
                <span className="whitespace-nowrap">
                  ระบบรองรับเฉพาะ Google
                </span>
                <hr className="flex-1 border-border" />
              </div>
              <Note icon="info">
                ถ้าน้องซื้อคอร์สไว้แล้ว
                ระบบจะเปิดสิทธิ์ให้อัตโนมัติเมื่อเข้าสู่ระบบด้วยอีเมลเดียวกับที่ใช้ชำระเงิน
              </Note>
              <p className="text-center text-[13.5px] text-ink3">
                การเข้าสู่ระบบถือว่ายอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
              </p>
            </div>
          )}
        </section>
      </main>
      <SlimFooter />
    </>
  );
}

/**
 * Already signed in: say which account, offer to continue or pick another.
 * The Google route always sends prompt=select_account, so "switch" is the
 * same link — the callback replaces the current session.
 */
function SignedIn({
  user,
  next,
  googleHref,
}: {
  user: SessionUser;
  next: string;
  googleHref: string;
}) {
  const name = user.displayName?.trim() || user.email;
  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-5">
      <h2 className="text-center text-[26px] font-semibold">
        เข้าสู่ระบบอยู่แล้ว
      </h2>
      <div className="flex w-full items-center gap-3.5 rounded-[18px] border border-border bg-page p-4">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google profile photo
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand">
            <Icon name="person" size={24} fill />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-display text-[16px] font-medium">
            {name}
          </span>
          <span className="truncate text-[14px] text-ink2">{user.email}</span>
        </span>
      </div>
      <Button href={next} icon="arrow_forward" trailingIcon className="w-full">
        ดำเนินการต่อด้วยบัญชีนี้
      </Button>
      <a
        href={googleHref}
        className="text-[15px] text-brand underline-offset-4 hover:underline"
      >
        เข้าสู่ระบบด้วยบัญชี Google อื่น
      </a>
    </div>
  );
}
