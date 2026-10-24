import { notFound, redirect } from "next/navigation";

import { SlimFooter } from "@/components/site-footer";
import { fetchExamPack, type ExamPackDetail } from "@/lib/api";
import { getSessionUser, sessionHeaders } from "@/lib/auth";
import { packAction } from "@/lib/exam-state";
import { ExamGate } from "./exam-gate";

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
 * One pack: the instructions screen first (questions, sections, points,
 * time, attempts), and the runner only after the student confirms — the
 * attempt, and so the clock, is created by that click. Needs a session and a
 * complete profile; the backend enforces both again on POST /attempts.
 */
export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exam/${slug}`)}`);
  if (!user.profileComplete) redirect(`/profile?next=${encodeURIComponent(`/exam/${slug}`)}`);

  let pack: ExamPackDetail;
  try {
    pack = await fetchExamPack(slug, await sessionHeaders());
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("404")) notFound();
    throw error;
  }

  const studentName = user.nickname ? `${user.nickname} (${user.firstName} ${user.lastName})` : user.email;
  return (
    <>
      <main className="flex flex-1 flex-col">
        <ExamGate pack={pack} action={packAction(pack)} studentName={studentName} />
      </main>
      <SlimFooter />
    </>
  );
}
