/* eslint-disable @next/next/no-img-element -- CMS covers */
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleSearch } from "@/components/article-search";
import { Band } from "@/components/ui";
import { BACKEND_URL } from "@/lib/api";
import type { ArticleCard } from "@/lib/articles";
export const metadata = { title: "บทเรียนและข่าวสาร จภ. · pipoltutor" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams,
    qs = new URLSearchParams();
  for (const k of ["q", "kind", "level", "subject", "category", "from", "to"])
    if (query[k]) qs.set(k, query[k]!);
  let data: {
    articles: (ArticleCard & {
      kind: string;
      expired: boolean;
      views?: number;
      popular?: boolean;
    })[];
    categories: { id: string; name: string }[];
    popularQueries: string[];
    total: number;
  } = { articles: [], categories: [], popularQueries: [], total: 0 };
  let error = false;
  try {
    const r = await fetch(`${BACKEND_URL}/articles?${qs}`, {
      cache: "no-store",
    });
    if (!r.ok) throw new Error();
    data = await r.json();
  } catch {
    error = true;
  }
  const select =
    "min-h-[48px] rounded-[12px] border border-border bg-card px-3 text-[16px]";
  return (
    <>
      <SiteHeader current="articles" />
      <main className="flex-1">
        <Band className="py-10">
          <div className="flex flex-col gap-6">
            <h1 className="text-[32px] font-semibold">บทเรียนและข่าวสาร จภ.</h1>
            <form
              className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-5"
              action="/articles"
            >
              <ArticleSearch initial={query.q} popular={data.popularQueries} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  name="kind"
                  aria-label="ประเภทเนื้อหา"
                  className={select}
                  defaultValue={query.kind ?? ""}
                >
                  <option value="">ทุกประเภท</option>
                  <option value="lesson">บทเรียน</option>
                  <option value="news">ข่าวสาร</option>
                </select>
                <select
                  name="level"
                  aria-label="ระดับชั้น"
                  className={select}
                  defaultValue={query.level ?? ""}
                >
                  <option value="">ทุกระดับ</option>
                  <option value="m1">ม.1</option>
                  <option value="m4">ม.4</option>
                </select>
                <input
                  name="subject"
                  aria-label="วิชา"
                  className={select}
                  defaultValue={query.subject ?? ""}
                  placeholder="วิชา เช่น math"
                />
                <select
                  name="category"
                  aria-label="หมวดหมู่"
                  className={select}
                  defaultValue={query.category ?? ""}
                >
                  <option value="">ทุกหมวด</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="text-[14px]">
                  ตั้งแต่
                  <input
                    name="from"
                    type="date"
                    className={`${select} w-full`}
                    defaultValue={query.from}
                  />
                </label>
                <label className="text-[14px]">
                  ถึง
                  <input
                    name="to"
                    type="date"
                    className={`${select} w-full`}
                    defaultValue={query.to}
                  />
                </label>
                <button
                  type="submit"
                  className="min-h-[48px] rounded-full bg-brand px-5 text-on-fill"
                >
                  ค้นหาและกรอง
                </button>
              </div>
            </form>
            {error ? (
              <p role="alert">โหลดบทความไม่ได้ กรุณาลองใหม่</p>
            ) : (
              <p className="text-[16px] text-ink2">พบ {data.total} บทความ</p>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.articles.map((a) => (
                <article
                  key={a.id}
                  className="overflow-hidden rounded-[20px] border border-border bg-card"
                >
                  {a.coverUrl ? (
                    <img
                      src={a.coverUrl}
                      alt={a.title}
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-col gap-3 p-5">
                    <p className="text-[14px] text-ink2">
                      {a.kind === "news" ? "ข่าวสาร" : "บทเรียน"}
                      {a.expired ? " · หมดเขตแล้ว" : ""}
                      {a.views !== undefined
                        ? ` · อ่าน ${a.views} ครั้ง`
                        : a.popular
                          ? " · ยอดนิยม"
                          : ""}
                    </p>
                    <h2 className="text-[21px] font-semibold leading-[1.35]">
                      <Link href={`/articles/${a.slug}`}>{a.title}</Link>
                    </h2>
                    {a.excerpt ? (
                      <p className="text-[16px] text-ink2">{a.excerpt}</p>
                    ) : null}
                    <Link
                      href={`/articles/${a.slug}`}
                      className="inline-flex min-h-[44px] items-center font-medium text-brand"
                    >
                      อ่านต่อ →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
