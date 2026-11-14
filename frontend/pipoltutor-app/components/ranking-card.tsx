import { BACKEND_URL } from "@/lib/api";
import { sessionHeaders } from "@/lib/auth";
type Rank = {
  status: string;
  selectedAttemptId: string | null;
  version: number;
  nRank: number;
  nRef: number;
  metrics: Record<string, number | null> | null;
  needsReview: boolean;
  zeroSd: boolean;
  note: string;
  statisticalNote: string;
};
export async function RankingCard({
  attemptId,
  compact = false,
}: {
  attemptId: string;
  compact?: boolean;
}) {
  let rank: Rank | null = null;
  try {
    const r = await fetch(`${BACKEND_URL}/attempts/${attemptId}/ranking`, {
      cache: "no-store",
      headers: await sessionHeaders(),
    });
    if (r.ok) rank = (await r.json()) as Rank;
  } catch {}
  if (!rank?.metrics) return null;
  const fmt = (v: number | null) => (v === null ? "N/A" : v.toFixed(2));
  const labels: Record<string, string> = {
    score: "คะแนนรับรอง",
    rank: "อันดับ",
    mean: "เฉลี่ย",
    sd: "SD",
    z: "Z-score",
    percentile: "เปอร์เซ็นไทล์",
  };
  if (compact)
    return (
      <p className="text-[14px] text-ink2">
        {rank.metrics.rank !== undefined
          ? `อันดับ ${rank.metrics.rank ?? "N/A"}/${rank.nRank} · `
          : ""}
        {rank.status === "final" ? "ผลรับรอง" : "เบื้องต้น"}
        {rank.needsReview ? " · รอทบทวน" : ""}
      </p>
    );
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-5">
      <h2 className="text-[21px] font-semibold">
        {rank.status === "final" ? "ผลรับรองล่าสุด" : "อันดับเบื้องต้น"} · v
        {rank.version}
      </h2>
      {rank.selectedAttemptId && rank.selectedAttemptId !== attemptId ? (
        <p className="text-[14px] text-ink2">
          อันดับนี้อิงครั้งสอบที่ระบบเลือกตามนโยบายของชุดสอบ{" "}
          <a
            className="text-brand underline"
            href={`/exam/result?attempt=${rank.selectedAttemptId}`}
          >
            ดูครั้งที่ใช้จัดอันดับ
          </a>
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Object.entries(rank.metrics).map(([key, value]) => (
          <div key={key}>
            <dt className="text-[14px] text-ink2">{labels[key]}</dt>
            <dd className="text-[23px] font-semibold tabular-nums">
              {key === "rank" ? `${value ?? "N/A"}/${rank!.nRank}` : fmt(value)}
            </dd>
          </div>
        ))}
      </dl>
      <p
        className={`text-[15px] ${rank.needsReview ? "text-amber-ink" : "text-ink2"}`}
      >
        {rank.note}
      </p>
      <p className="text-[14px] text-ink2">
        {rank.statisticalNote} · กลุ่มอ้างอิง {rank.nRef} คน
        {rank.zeroSd ? " · กลุ่มอ้างอิงมี SD=0 จึงแสดง Z-score=0.00" : ""}
      </p>
    </section>
  );
}
