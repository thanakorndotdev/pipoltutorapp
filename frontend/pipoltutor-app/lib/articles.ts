import { BACKEND_URL } from "./api";
import { sessionHeaders } from "./auth";

/** One piece of an article body; mirrors ArticleBlock in backend/app/src/db/schema.ts. */
export type ArticleBlock =
  | { type: "heading"; text: string }
  /** Paragraphs split on blank lines; **bold** and bare https links are the only inline marks. */
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string; caption: string; width?: number; align?: "left" | "center" | "right" }
  | { type: "rich"; text: string; fontSize?: number; color?: string; background?: string; align?: "left" | "center" | "right" }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "quote" | "code" | "callout" | "math"; text: string }
  | { type: "separator" }
  | { type: "button" | "attachment"; text: string; url: string }
  | { type: "video"; url: string; title: string }
  | { type: "columns"; columns: ArticleBlock[][] }
  | { type: "table"; rows: { text: string; rowSpan?: number; colSpan?: number; align?: "left" | "center" | "right"; background?: string }[][] };

export type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

export type Article = ArticleCard & { blocks: ArticleBlock[];kind:"lesson"|"news";sourceUrl:string|null;sourceCredit:string|null;sourceDate:string|null;deadline:string|null;expired:boolean;viewMode:string;views?:number;popular?:boolean };

/** GET /articles — published articles, newest first. Throws when the backend is unreachable. */
export async function fetchArticles(): Promise<ArticleCard[]> {
  const res = await fetch(`${BACKEND_URL}/articles`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /articles failed: ${res.status}`);
  return ((await res.json()) as { articles: ArticleCard[] }).articles;
}

/**
 * GET /articles/:slug — null when there is no such article. The session
 * cookie rides along so an admin can open a draft to preview it.
 */
export async function fetchArticle(slug: string): Promise<Article | null> {
  const res = await fetch(`${BACKEND_URL}/articles/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    headers: await sessionHeaders(),
  });
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) throw new Error(`GET /articles/${slug} failed: ${res.status}`);
  return ((await res.json()) as { article: Article }).article;
}
