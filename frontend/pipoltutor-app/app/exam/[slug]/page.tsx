import { notFound, redirect } from "next/navigation";

import { SlimFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Band, Button, Card, Icon } from "@/components/ui";
import { fetchExamPack, type ExamPack } from "@/lib/api";
import { getSessionUser, sessionHeaders } from "@/lib/auth";
import { ExamClient } from "./exam-client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const pack = await fetchExamPack(slug, await sessionHeaders());
    return { title: `${pack.title} · PIPOL TUTOR` };
  } catch {
    return { title: "ทำข้อสอบ · PIPOL TUTOR" };
  }
}

/**
 * The runner for one pack. A pack the student has not unlocked renders the
 * locked screen instead of the runner — advisory only, the backend refuses
 * POST /attempts for it regardless. The runner itself needs a session:
 * questions come only from an attempt, and attempts belong to a user.
 */
export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let pack: ExamPack;
  try {
    pack = await fetchExamPack(slug, await sessionHeaders());
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("404")) notFound();
    throw error;
  }

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exam/${slug}`)}`);

  if (!pack.unlocked) {
    return (
      <>
        <SiteHeader current="exam" app />
        <main className="flex-1">
          <Band className="pb-14 pt-10 md:pb-[72px]">
            <Card className="mx-auto flex max-w-[560px] flex-col items-center gap-4 py-12 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-icon">
                <Icon name="lock" size={32} fill />
              </span>
              <h1 className="text-[24px] font-semibold md:text-[28px]">{pack.title}</h1>
              <p className="max-w-[420px] text-[16px] text-ink2">
                ชุดนี้ยังไม่เปิดให้ทำ ซื้อคอร์สหรือชุดข้อสอบที่ปลดล็อกชุดนี้ก่อน แล้วระบบจะเปิดให้ทันทีเมื่อชำระเงินสำเร็จ
              </p>
              <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                <Button href="/exam" icon="arrow_back" kind="ghost">กลับไปคลังข้อสอบ</Button>
                <Button href="/courses" icon="shopping_bag">ดูคอร์สและราคา</Button>
              </div>
            </Card>
          </Band>
        </main>
        <SlimFooter />
      </>
    );
  }

  return (
    <>
      <main className="flex flex-1 flex-col">
        <ExamClient packId={pack.id} packTitle={pack.title} studentName={user.displayName ?? user.email} />
      </main>
      <SlimFooter />
    </>
  );
}
