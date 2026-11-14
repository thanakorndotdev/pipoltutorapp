"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Button,
  Card,
  Empty,
  Icon,
  Note,
  PageHeader,
  Spinner,
  Tag,
} from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDate, formatThaiDateTime } from "@/lib/format";
import type { ArticleCard } from "@/lib/types";

const linkBtn =
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-medium";

export function ArticleList() {
  const { api } = useAdmin();
  const [articles, setArticles] = useState<ArticleCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ articles: ArticleCard[] }>("/admin/articles")
      .then((r) => {
        if (cancelled) return;
        setArticles(r.articles);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, tick]);

  async function remove(a: ArticleCard) {
    if (confirmId !== a.id) {
      setConfirmId(a.id);
      return;
    }
    setConfirmId(null);
    try {
      await api(`/admin/articles/${a.id}`, { method: "DELETE" });
      setTick((t) => t + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="บทความ"
        sub="บทความที่เผยแพร่แล้วแสดงในหน้า “บทความ” ของเว็บ เรียงจากใหม่ไปเก่า · ฉบับร่างเห็นเฉพาะผู้ดูแล"
        actions={
          <Link
            href="/articles/edit/"
            className={`${linkBtn} min-h-[44px] gap-2 bg-brand px-4 text-[15px] text-on-fill hover:bg-brand-dark`}
          >
            <Icon name="add" size={19} />
            เพิ่มบทความ
          </Link>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      {articles === null && !error ? <Spinner /> : null}
      {articles && articles.length === 0 ? (
        <Empty icon="article">
          ยังไม่มีบทความ กด “เพิ่มบทความ” เพื่อเขียนบทความแรก
        </Empty>
      ) : null}
      {articles && articles.length > 0 ? (
        <ul className="flex max-w-[920px] flex-col gap-3">
          {articles.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static export, arbitrary hosts
                  <img
                    src={a.coverUrl}
                    alt=""
                    className="aspect-video w-full shrink-0 rounded-[12px] border border-border object-cover sm:w-[176px]"
                  />
                ) : (
                  <div className="flex aspect-video w-full shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-brand sm:w-[176px]">
                    <Icon name="article" size={30} />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.published ? (
                      <Tag tone="green">เผยแพร่แล้ว</Tag>
                    ) : (
                      <Tag tone="amber">ฉบับร่าง</Tag>
                    )}
                    <span className="text-[13px] text-ink3">
                      {a.published && a.publishedAt
                        ? `เผยแพร่ ${formatThaiDate(a.publishedAt)} · `
                        : ""}
                      แก้ล่าสุด {formatThaiDateTime(a.updatedAt)}
                    </span>
                  </div>
                  <p className="text-[16px] font-medium">{a.title}</p>
                  {a.excerpt ? (
                    <p className="line-clamp-2 text-[13.5px] text-ink2">
                      {a.excerpt}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 sm:w-[132px] sm:flex-col">
                  <Link
                    href={`/articles/edit/?id=${a.id}`}
                    className={`${linkBtn} justify-center bg-brand text-on-fill hover:bg-brand-dark`}
                  >
                    <Icon name="edit" size={17} />
                    แก้ไข
                  </Link>
                  {/* Plain <a>: the page lives on the main site, outside this app's /admin basePath. */}
                  <a
                    href={`/articles/${a.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkBtn} justify-center border-[1.5px] border-border-strong bg-card text-ink hover:bg-page`}
                  >
                    <Icon name="open_in_new" size={17} />
                    {a.published ? "ดูหน้าเว็บ" : "ดูตัวอย่าง"}
                  </a>
                  {confirmId === a.id ? (
                    <Button
                      kind="ghost"
                      size="sm"
                      onClick={() => setConfirmId(null)}
                    >
                      ยกเลิก
                    </Button>
                  ) : null}
                  <Button
                    kind="danger"
                    size="sm"
                    icon="delete"
                    onClick={() => remove(a)}
                  >
                    {confirmId === a.id ? "ยืนยันลบ" : "ลบ"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
