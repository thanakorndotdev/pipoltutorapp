"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AttemptAnswers } from "@/components/attempt-answers";
import { Button, Card, Empty, Icon, Note, PageHeader, Spinner, Tag } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateTime } from "@/lib/format";
import { ATTEMPT_STATUS, CAMPUS_LABEL, fmtPoints, type AttemptDetail, type StudentDetail } from "@/lib/types";

function used(a: { startedAt: string; submittedAt: string | null }): string {
  if (!a.submittedAt) return "—";
  const s = Math.round((new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 1000);
  return `${Math.floor(s / 60)} นาที ${s % 60} วินาที`;
}

/**
 * One student's scores: current profile, then every attempt on every pack
 * with its score, and the full answer and section breakdown of the attempt
 * picked. Reached from a name on the results page or the users list.
 */
export function Student() {
  const { api } = useAdmin();
  const id = useSearchParams().get("id") ?? "";
  const [data, setData] = useState<StudentDetail | null>(null);
  const [open, setOpen] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api<StudentDetail>(`/admin/users/${id}`)
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setError(null);
        // Open the newest finished attempt so the score is visible straight away.
        const latest = [...r.attempts].reverse().find((a) => a.status !== "in_progress");
        if (latest) api<AttemptDetail>(`/admin/attempts/${latest.id}`).then((d) => !cancelled && setOpen(d)).catch(() => {});
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  async function show(attemptId: string) {
    try {
      setOpen(await api<AttemptDetail>(`/admin/attempts/${attemptId}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!id) return <Note tone="error">ไม่ระบุนักเรียน</Note>;
  if (error && !data) return <Note tone="error">{error}</Note>;
  if (!data) return <Spinner />;

  const u = data.user;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.email;
  const finished = data.attempts.filter((a) => a.status !== "in_progress" && !a.resetAt);

  return (
    <>
      <PageHeader
        title={u.nickname ? `${name} (${u.nickname})` : name}
        sub={`${u.email} · ${u.campus ? (CAMPUS_LABEL[u.campus] ?? u.campus) : "ยังไม่กรอก จภ."}`}
        actions={
          <button type="button" onClick={() => history.back()} className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border-[1.5px] border-border-strong bg-card px-4 text-[15px] font-medium text-ink">
            <Icon name="arrow_back" size={19} /> กลับ
          </button>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-ink3">ทำข้อสอบทั้งหมด</span>
          <span className="tabular text-[22px] font-semibold">{data.attempts.length} ครั้ง</span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-ink3">ชุดที่ทำ</span>
          <span className="tabular text-[22px] font-semibold">{new Set(data.attempts.map((a) => a.packId)).size} ชุด</span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-ink3">คะแนนสูงสุด (%)</span>
          <span className="tabular text-[22px] font-semibold">
            {finished.length ? `${Math.max(...finished.map((a) => (a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : 0)))}%` : "—"}
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-ink3">สมัครเมื่อ</span>
          <span className="text-[15px] font-semibold">{u.createdAt ? formatThaiDateTime(u.createdAt) : "—"}</span>
        </Card>
      </div>

      {data.attempts.length === 0 ? (
        <Empty icon="history">นักเรียนคนนี้ยังไม่เคยทำข้อสอบ</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card className="flex flex-col gap-2 self-start">
            <h2 className="text-[16px] font-semibold">ประวัติการสอบ</h2>
            <ul className="flex flex-col gap-2">
              {[...data.attempts].reverse().map((a) => {
                const on = open?.attempt.id === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => show(a.id)}
                      aria-pressed={on}
                      className={`flex w-full flex-col gap-1 rounded-[14px] border px-3 py-2.5 text-left ${on ? "border-brand bg-brand-50" : "border-border bg-page hover:border-border-strong"}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{a.packTitle}</span>
                        <span className="tabular shrink-0 text-[15px] font-semibold">
                          {a.score === null ? "—" : `${fmtPoints(a.score)}/${fmtPoints(a.maxScore)}`}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink3">
                        ครั้งที่ {a.attemptNo} · {formatThaiDateTime(a.startedAt)} · ใช้เวลา {used(a)}
                        <Tag tone={ATTEMPT_STATUS[a.status].tone}>{ATTEMPT_STATUS[a.status].label}</Tag>
                        {a.resetAt ? <Tag>รีเซ็ตแล้ว</Tag> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="flex flex-col gap-3">
            {open ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[16px] font-semibold">
                    {open.attempt.pack.title} · ครั้งที่ {open.attempt.attemptNo}
                  </h2>
                  <Link href={`/results/?pack=${open.attempt.packId}`} className="text-[14px] font-medium text-brand hover:underline">
                    ผลสอบทั้งชุด →
                  </Link>
                </div>
                <AttemptAnswers detail={open} />
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-ink3">
                <Icon name="touch_app" size={30} />
                <p>เลือกการสอบทางซ้ายเพื่อดูคะแนนรายตอนและรายข้อ</p>
                {data.attempts.some((a) => a.status === "in_progress") ? (
                  <Button kind="ghost" size="sm" onClick={() => show(data.attempts.find((a) => a.status === "in_progress")!.id)}>
                    ดูครั้งที่กำลังทำ
                  </Button>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
