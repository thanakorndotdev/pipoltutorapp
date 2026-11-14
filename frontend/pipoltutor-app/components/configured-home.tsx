import Link from "next/link";
import { Band, Button } from "./ui";
import { PlanGrid } from "./blocks";
import { BACKEND_URL } from "@/lib/api";
import type { ArticleCard } from "@/lib/articles";
type Section = { key: string; enabled: boolean; articleIds: string[] };
export async function getHomeSections(): Promise<Section[]> {
  try {
    const r = await fetch(`${BACKEND_URL}/site/home`, { cache: "no-store" });
    return r.ok ? ((await r.json()).sections ?? []) : [];
  } catch {
    return [];
  }
}
export async function ConfiguredHome({
  sections,
  title,
  lede,
}: {
  sections: Section[];
  title: string;
  lede: string;
}) {
  let articles: (ArticleCard & { kind: string })[] = [];
  try {
    const r = await fetch(`${BACKEND_URL}/articles?limit=100`, {
      cache: "no-store",
    });
    if (r.ok) articles = (await r.json()).articles;
  } catch {}
  return (
    <>
      {sections
        .filter((s) => s.enabled)
        .map((s) => (
          <Band key={s.key} className="py-10 md:py-14">
            {s.key === "hero" ? (
              <div className="flex max-w-[850px] flex-col gap-6">
                <h1 className="text-[34px] font-semibold leading-[1.35] md:text-[46px]">
                  {title}
                </h1>
                <p className="text-[18px] text-ink2">{lede}</p>
                <div className="flex flex-wrap gap-3">
                  <Button href="/exam">ทำข้อสอบ</Button>
                  <Button href="/courses" kind="ghost">
                    คอร์สเรียน
                  </Button>
                </div>
              </div>
            ) : s.key === "courses" ? (
              <>
                <h2 className="mb-6 text-[28px] font-semibold">คอร์สเรียน</h2>
                <PlanGrid />
              </>
            ) : s.key === "daily" ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[28px] font-semibold">โจทย์ประจำวัน</h2>
                <p className="text-[17px] text-ink2">
                  ทำโจทย์วันนี้เพื่อเพิ่มและรักษาไฟของน้อง
                </p>
                <Button href="/daily">ทำโจทย์วันนี้</Button>
              </div>
            ) : s.key === "exams" ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[28px] font-semibold">คลังข้อสอบ</h2>
                <p className="text-[17px] text-ink2">
                  เลือกชุดข้อสอบและดูประวัติการสอบของน้อง
                </p>
                <Button href="/exam">เปิดคลังข้อสอบ</Button>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-[28px] font-semibold">
                  {s.key === "news" ? "ข่าวสารล่าสุด" : "บทเรียนแนะนำ"}
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {articles
                    .filter((a) =>
                      s.articleIds.length
                        ? s.articleIds.includes(a.id)
                        : a.kind === (s.key === "news" ? "news" : "lesson"),
                    )
                    .slice(0, 6)
                    .map((a) => (
                      <article
                        key={a.id}
                        className="rounded-[20px] border border-border bg-card p-5"
                      >
                        <h3 className="text-[21px] font-semibold">
                          <Link href={`/articles/${a.slug}`}>{a.title}</Link>
                        </h3>
                        <p className="mt-3 text-[16px] text-ink2">
                          {a.excerpt}
                        </p>
                        <Link
                          href={`/articles/${a.slug}`}
                          className="mt-3 inline-flex min-h-[44px] items-center text-brand"
                        >
                          อ่านต่อ →
                        </Link>
                      </article>
                    ))}
                </div>
              </>
            )}
          </Band>
        ))}
    </>
  );
}
