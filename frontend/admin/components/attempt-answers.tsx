"use client";

import { Tag } from "@/components/ui";
import { CAMPUS_LABEL, fmtPoints, typeMeta, type AttemptDetail } from "@/lib/types";

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Score report for one attempt: total, points per ตอน, then every question
 * with the student's answer, the key and the points earned. Used by the
 * results page and the per-student page.
 */
export function AttemptAnswers({ detail }: { detail: AttemptDetail }) {
  const a = detail.attempt;
  const sections: { title: string; points: number; max: number; answered: number; total: number }[] = [];
  for (const q of detail.questions) {
    const title = q.section ?? "";
    let s = sections.find((x) => x.title === title);
    if (!s) sections.push((s = { title, points: 0, max: 0, answered: 0, total: 0 }));
    s.points = round(s.points + (q.pointsAwarded ?? 0));
    s.max = round(s.max + q.points);
    s.total += 1;
    if (q.selectedChoices.length > 0 || q.textAnswer) s.answered += 1;
  }
  const pct = a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[16px] bg-page p-4">
        <div className="text-[14px] text-ink2">
          <p>{a.email} · {a.campus ? (CAMPUS_LABEL[a.campus] ?? a.campus) : "—"}</p>
          <p className="text-[13px] text-ink3">ข้อมูล ณ วันที่เริ่มสอบ</p>
        </div>
        <div className="text-right">
          <p className="tabular text-[26px] font-semibold leading-tight">
            {fmtPoints(a.score)}<span className="text-[16px] text-ink3">/{fmtPoints(a.maxScore)}</span>
          </p>
          <p className="text-[13px] text-ink3">{pct === null ? "ยังไม่ส่ง" : `${pct}%`}</p>
          {a.scoreHistory?.length ? (
            <p className="text-[12.5px] text-ink3">ก่อนตรวจใหม่ {fmtPoints(a.scoreHistory[0].score)}</p>
          ) : null}
        </div>
      </div>

      {sections.length > 1 || sections[0]?.title ? (
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-page text-[13px] text-ink3">
              <tr>
                <th className="px-3 py-2 font-medium">ตอน</th>
                <th className="px-3 py-2 font-medium">ตอบแล้ว</th>
                <th className="px-3 py-2 text-right font-medium">คะแนน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sections.map((s) => (
                <tr key={s.title}>
                  <td className="px-3 py-2">{s.title || "ไม่ระบุตอน"}</td>
                  <td className="tabular px-3 py-2">{s.answered}/{s.total} ข้อ</td>
                  <td className="tabular px-3 py-2 text-right font-semibold">{fmtPoints(s.points)}/{fmtPoints(s.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ol className="flex flex-col gap-2">
        {detail.questions.map((x) => {
          const given = x.type === "short" ? x.textAnswer : x.selectedChoices.join(", ");
          const key = x.type === "short" ? x.acceptedAnswers.join(" / ") : x.correctChoices.join(", ");
          const full = x.pointsAwarded !== null && x.pointsAwarded >= x.points;
          const zero = !x.pointsAwarded;
          return (
            <li key={x.questionId} className={`rounded-[14px] border p-3 ${full ? "border-green/40 bg-green-50" : zero ? "border-red/30 bg-red-50" : "border-amber-icon/40 bg-amber-50"}`}>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold">ข้อ {x.position}</span>
                {x.section ? <Tag>{x.section}</Tag> : null}
                <Tag tone="teal">{typeMeta(x.type).short}</Tag>
                <span className="tabular ml-auto font-semibold">
                  {fmtPoints(x.pointsAwarded ?? 0)}/{fmtPoints(x.points)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[14px]">{x.prompt}</p>
              <p className="mt-1 text-[13.5px]">
                ตอบ: <b>{given || "ไม่ได้ตอบ"}</b> · เฉลย: {key}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
