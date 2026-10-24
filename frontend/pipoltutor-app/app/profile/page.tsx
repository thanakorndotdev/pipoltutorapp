import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Band, Card, Pill } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "ข้อมูลนักเรียน · PIPOL TUTOR" };

/**
 * Only same-site paths are honoured as the place to go after saving. Parsing
 * with the URL parser (not prefix checks) catches `/\evil.com` and tab or
 * newline tricks that browsers normalise into a protocol-relative `//evil.com`.
 */
function safeNext(raw: string | string[] | undefined): string {
  const fallback = "/exam";
  const v = typeof raw === "string" ? raw : "";
  if (!v.startsWith("/")) return fallback;
  const base = "https://placeholder.invalid";
  try {
    const url = new URL(v, base);
    if (url.origin !== base || url.pathname.startsWith("/api/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * First visit after Google login asks for name, surname, nickname and the
 * จภ. applied to; later visits edit them. /exam pages send students here
 * until the profile is complete.
 */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNext((await searchParams).next);
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/profile?next=${next}`)}`);
  const first = !user.profileComplete;

  return (
    <>
      <SiteHeader current="exam" app />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px]">
          <div className="mx-auto flex max-w-[760px] flex-col gap-6">
            <header className="flex flex-col gap-3">
              <div><Pill icon="badge">ข้อมูลนักเรียน</Pill></div>
              <h1 className="text-[28px] font-semibold md:text-[34px]">{first ? "กรอกข้อมูลก่อนเริ่มทำข้อสอบ" : "แก้ไขข้อมูลนักเรียน"}</h1>
              <p className="text-[16px] text-ink2">
                {first
                  ? "กรอกครั้งเดียว ครั้งต่อไปเข้าสู่ระบบด้วย Google บัญชีเดิมแล้วทำข้อสอบได้เลย"
                  : "ข้อมูลใหม่ใช้กับการสอบครั้งถัดไป ผลสอบที่ทำไปแล้วยังเก็บข้อมูล ณ วันที่สอบไว้เหมือนเดิม"}
              </p>
            </header>
            <Card className="p-5 md:p-7">
              <ProfileForm
                first={first}
                next={next}
                email={user.email}
                initial={{
                  firstName: user.firstName ?? "",
                  lastName: user.lastName ?? "",
                  nickname: user.nickname ?? "",
                  campus: user.campus ?? "",
                }}
              />
            </Card>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
