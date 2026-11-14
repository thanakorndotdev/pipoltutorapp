import { ArticleDiscussion } from "@/components/article-discussion";
import { getSessionUser } from "@/lib/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ArticleBlocks } from "@/components/article-blocks";
import { CtaBand, SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Band, Button, Note } from "@/components/ui";
import { fetchArticle } from "@/lib/articles";
import { formatThaiDate } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

/** generateMetadata and the page share one backend request per render. */
const getArticle = cache((slug: string) => fetchArticle(slug));

/**
 * Link previews (LINE, Facebook) need an absolute image URL, and an uploaded
 * cover is a same-origin path, so it is resolved against the host the
 * visitor asked for.
 */
async function absoluteUrl(path: string): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  try {
    return new URL(
      path,
      `${h.get("x-forwarded-proto") ?? "https"}://${host}`,
    ).toString();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle((await params).slug);
  if (!article) return { title: "ไม่พบบทความ · pipoltutor" };
  const description = article.excerpt ?? undefined;
  const image = article.coverUrl ? await absoluteUrl(article.coverUrl) : null;
  return {
    title: `${article.title} · pipoltutor`,
    description,
    alternates: {
      canonical: (await absoluteUrl(`/articles/${article.slug}`)) ?? undefined,
    },
    // A draft is reachable only by an admin; keep it out of search results too.
    robots: article.published ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();
  const user = await getSessionUser();
  const canonical = await absoluteUrl(`/articles/${article.slug}`);

  return (
    <>
      <SiteHeader current="articles" />
      <main className="flex-1">
        <Band className="pb-14 pt-8 md:pb-[72px] md:pt-9">
          <article className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
            <p className="text-[14px] text-ink3">
              <Link href="/articles" className="hover:text-brand">
                บทความ
              </Link>{" "}
              · {article.title}
            </p>
            {article.published ? null : (
              <Note
                icon="visibility_off"
                className="bg-amber-50"
                iconClass="text-amber-icon"
              >
                ฉบับร่าง — เห็นเฉพาะผู้ดูแลระบบ ยังไม่แสดงบนเว็บ
              </Note>
            )}
            <header className="flex flex-col gap-3">
              <h1
                className="text-[30px] font-semibold md:text-[38px]"
                style={{ textWrap: "balance" }}
              >
                {article.title}
              </h1>
              {article.publishedAt ? (
                <p className="text-[14.5px] text-ink3">
                  เผยแพร่ {formatThaiDate(article.publishedAt)}
                </p>
              ) : null}
              {article.excerpt ? (
                <p className="text-[18px] text-ink2">{article.excerpt}</p>
              ) : null}
            </header>
            {article.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, arbitrary hosts
              <img
                src={article.coverUrl}
                alt=""
                className="aspect-video w-full rounded-[24px] object-cover shadow-m"
              />
            ) : null}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": article.kind === "news" ? "NewsArticle" : "Article",
                  headline: article.title,
                  description: article.excerpt,
                  datePublished: article.publishedAt,
                  dateModified: article.updatedAt,
                  image: article.coverUrl
                    ? await absoluteUrl(article.coverUrl)
                    : undefined,
                  mainEntityOfPage: canonical,
                }).replaceAll("<", "\\u003c"),
              }}
            />
            {article.viewMode === "views" ? (
              <p className="text-[14px] text-ink3">
                อ่านแล้ว {article.views ?? 0} ครั้ง
              </p>
            ) : article.viewMode === "popular" &&
              (article.views ?? 0) >= 100 ? (
              <p className="text-[14px] text-brand">บทความยอดนิยม</p>
            ) : null}
            {article.expired ? (
              <Note icon="event_busy">ข่าวนี้หมดเขตแล้ว ยังอ่านข้อมูลย้อนหลังได้</Note>
            ) : null}
            {article.sourceUrl ? (
              <p className="text-[14px] text-ink2">
                แหล่งข่าว:{" "}
                <a
                  href={article.sourceUrl}
                  className="text-brand underline"
                  rel="noopener noreferrer"
                >
                  {article.sourceCredit ?? article.sourceUrl}
                </a>
                {article.sourceDate ? ` · ${article.sourceDate}` : ""}
              </p>
            ) : null}
            <ArticleBlocks blocks={article.blocks} />
            <ArticleDiscussion slug={article.slug} loggedIn={!!user} />
            <div className="border-t border-border pt-6">
              <Button href="/articles" kind="ghost" icon="arrow_back">
                บทความทั้งหมด
              </Button>
            </div>
          </article>
        </Band>
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
