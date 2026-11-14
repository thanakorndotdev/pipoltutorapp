import { randomBytes } from "node:crypto";
import { Elysia, t } from "elysia";
import { and, desc, eq, sql } from "drizzle-orm";
import { currentUser } from "../auth";
import { readCookie } from "../sessions";
import { db } from "../db";
import { articles, users } from "../db/schema";
import {
  articleEvents,
  articleRedirects,
  categories,
  comments,
  searchQueries,
} from "../db/features";
import { bangkokDay, fail, hash, lock } from "../features/common";
import {
  nearMatch,
  notifyReply,
  publicSnapshot,
  publishDue,
  searchable,
  settings,
} from "../features/cms";
export const articleCardColumns = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  coverUrl: articles.coverUrl,
  published: articles.published,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
};
export const articleColumns = {
  ...articleCardColumns,
  blocks: articles.blocks,
};
const slugParams = t.Object({
  slug: t.String({ minLength: 1, maxLength: 120 }),
});
function visitor(
  headers: Record<string, string | undefined>,
  set: { headers: Record<string, unknown> },
) {
  let id = readCookie(headers, "pt_visitor");
  if (!id || !/^[-a-f\d]{32}$/.test(id)) {
    id = randomBytes(16).toString("hex");
    set.headers["set-cookie"] =
      `pt_visitor=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  }
  return hash(id);
}
export const articlesRoutes = new Elysia({ prefix: "/articles" })
  .get(
    "/",
    async ({ query, headers, set }) => {
      await publishDue();
      const all = (
        await db
          .select()
          .from(articles)
          .where(eq(articles.published, true))
          .orderBy(desc(articles.publishedAt))
          .limit(5000)
      )
        .filter((a) => !["deleted", "archived"].includes(a.workflow))
        .map(publicSnapshot);
      const taxonomy = await db.select().from(categories);
      const synonyms = await settings<Record<string, string[]>>(
        "cms.synonyms",
        {},
      );
      let category = query.category;
      const seen = new Set<string>();
      while (category && !seen.has(category)) {
        seen.add(category);
        const alias = await settings<string | null>(
          `taxonomy.alias.${category}`,
          null,
        );
        if (!alias) break;
        category = alias;
      }
      const q = query.q?.trim().toLowerCase().normalize("NFC");
      const searches = q ? [q, ...(synonyms[q] ?? [])] : [];
      const found = all.filter(
        (a) =>
          (!query.kind || a.kind === query.kind) &&
          (!query.level || a.levels.includes(query.level)) &&
          (!query.subject || a.subjects.includes(query.subject)) &&
          (!category || a.categoryIds.includes(category)) &&
          (!query.from || String(a.publishedAt) >= query.from) &&
          (!query.to || String(a.publishedAt).slice(0, 10) <= query.to) &&
          (!q ||
            searches.some((s) =>
              nearMatch(
                searchable(a) +
                  " " +
                  taxonomy
                    .filter((c) => a.categoryIds.includes(c.id))
                    .map((c) => c.name)
                    .join(" "),
                s,
              ),
            )),
      );
      if (q)
        await db
          .insert(searchQueries)
          .values({
            query: q,
            visitorKey: visitor(headers, set),
            day: bangkokDay(),
          })
          .onConflictDoNothing();
      const counts = await db
        .select({ id: articleEvents.articleId, n: sql<number>`count(*)::int` })
        .from(articleEvents)
        .where(eq(articleEvents.kind, "view"))
        .groupBy(articleEvents.articleId);
      const popular = await db
        .select({ query: searchQueries.query, n: sql<number>`count(*)::int` })
        .from(searchQueries)
        .groupBy(searchQueries.query)
        .orderBy(sql`count(*) desc`)
        .limit(10);
      return {
        articles: found
          .slice(
            Number(query.offset ?? 0),
            Number(query.offset ?? 0) + Number(query.limit ?? 50),
          )
          .map(({ blocks, ...a }) => ({
            ...a,
            ...(a.viewMode === "views"
              ? { views: counts.find((c) => c.id === a.id)?.n ?? 0 }
              : a.viewMode === "popular"
                ? { popular: (counts.find((c) => c.id === a.id)?.n ?? 0) >= 10 }
                : {}),
          })),
        total: found.length,
        categories: taxonomy,
        popularQueries: popular.map((p) => p.query),
        suggestions: q ? found.slice(0, 8).map((a) => a.title) : [],
      };
    },
    {
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 120 })),
        kind: t.Optional(t.Union([t.Literal("lesson"), t.Literal("news")])),
        level: t.Optional(t.String({ maxLength: 10 })),
        subject: t.Optional(t.String({ maxLength: 120 })),
        category: t.Optional(t.String({ format: "uuid" })),
        from: t.Optional(t.String({ maxLength: 10 })),
        to: t.Optional(t.String({ maxLength: 10 })),
        offset: t.Optional(t.Numeric({ minimum: 0, maximum: 10000 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    },
  )
  .get(
    "/:slug",
    async ({ params, set }) => {
      await publishDue();
      const [a] = await db
        .select()
        .from(articles)
        .where(eq(articles.slug, params.slug));
      if (!a) {
        const [r] = await db
          .select()
          .from(articleRedirects)
          .innerJoin(articles, eq(articles.id, articleRedirects.articleId))
          .where(eq(articleRedirects.slug, params.slug));
        if (r?.articles.published) {
          set.status = 301;
          set.headers.location = `/api/articles/${r.articles.slug}`;
          return { redirect: r.articles.slug };
        }
        fail("ไม่พบบทความ", 404);
      }
      if (a!.workflow === "deleted") {
        set.status = a!.publishedAt ? 410 : 404;
        return { error: "บทความนี้ถูกนำออกแล้ว" };
      }
      if (!a!.published || a!.workflow === "archived") fail("ไม่พบบทความ", 404);
      const [count] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(articleEvents)
        .where(
          and(
            eq(articleEvents.articleId, a!.id),
            eq(articleEvents.kind, "view"),
          ),
        );
      const snapshot = publicSnapshot(a!);
      return {
        article: {
          ...snapshot,
          views: snapshot.viewMode === "none" ? undefined : (count?.n ?? 0),
        },
      };
    },
    { params: slugParams },
  )
  .post(
    "/:slug/event",
    async ({ params, body, headers, set }) => {
      const [a] = await db
        .select()
        .from(articles)
        .where(
          and(eq(articles.slug, params.slug), eq(articles.published, true)),
        );
      if (!a) fail("ไม่พบบทความ", 404);
      let referrer: string | null = null;
      try {
        referrer = body.referrer ? new URL(body.referrer).hostname : null;
      } catch {}
      await db
        .insert(articleEvents)
        .values({
          articleId: a!.id,
          visitorKey: visitor(headers, set),
          day: bangkokDay(),
          kind: body.kind,
          referrer,
        })
        .onConflictDoNothing();
      return { ok: true };
    },
    {
      params: slugParams,
      body: t.Object({
        kind: t.Union([
          t.Literal("view"),
          t.Literal("click_in"),
          t.Literal("click_out"),
        ]),
        referrer: t.Optional(t.String({ maxLength: 2000 })),
      }),
    },
  )
  .get(
    "/:slug/comments",
    async ({ params, query }) => {
      const [a] = await db
        .select()
        .from(articles)
        .where(
          and(eq(articles.slug, params.slug), eq(articles.published, true)),
        );
      if (!a) fail("ไม่พบบทความ", 404);
      return {
        comments: await db
          .select({
            id: comments.id,
            parentId: comments.parentId,
            text: comments.text,
            createdAt: comments.createdAt,
            // Nickname first: commenters are students, so the Google full name is a fallback only.
            name: sql<string | null>`coalesce(${users.nickname}, ${users.displayName})`,
            authorId: users.id,
            photo: sql<string | null>`coalesce(${users.photoUrl}, ${users.avatarUrl})`,
          })
          .from(comments)
          .innerJoin(users, eq(users.id, comments.userId))
          .where(
            and(
              eq(comments.articleId, a!.id),
              eq(comments.status, "published"),
            ),
          )
          .orderBy(comments.createdAt)
          .limit(Number(query.limit ?? 100))
          .offset(Number(query.offset ?? 0)),
      };
    },
    {
      params: slugParams,
      query: t.Object({
        offset: t.Optional(t.Numeric({ minimum: 0, maximum: 10000 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    },
  )
  .post(
    "/:slug/comments",
    async ({ params, body, headers }) => {
      const u = await currentUser(headers);
      if (!u) fail("กรุณาเข้าสู่ระบบด้วย Google ก่อนแสดงความคิดเห็น", 401);
      const [a] = await db
        .select()
        .from(articles)
        .where(
          and(eq(articles.slug, params.slug), eq(articles.published, true)),
        );
      if (!a || a.workflow === "deleted") fail("ไม่พบบทความ", 404);
      const words = await settings<string[]>("cms.moderationWords", [
        "พนัน",
        "รับแทงบอล",
        "สล็อต",
        "fuck",
      ]);
      const text = body.text.trim();
      if (!text) fail("กรอกข้อความ");
      return db.transaction(async (tx) => {
        await lock(tx, `comment:${u!.id}`);
        const recent = await tx
          .select()
          .from(comments)
          .where(
            and(
              eq(comments.userId, u!.id),
              sql`${comments.createdAt}>now()-interval '1 minute'`,
            ),
          );
        if (recent.length >= 5) fail("ส่งความคิดเห็นบ่อยเกินไป กรุณารอ 1 นาที", 429);
        if (body.parentId) {
          const [p] = await tx
            .select()
            .from(comments)
            .where(
              and(
                eq(comments.id, body.parentId),
                eq(comments.articleId, a!.id),
                eq(comments.status, "published"),
              ),
            );
          if (!p) fail("ไม่พบความคิดเห็นต้นทาง", 404);
        }
        const flags = [
          ...(words.some((w) => text.toLowerCase().includes(w.toLowerCase()))
            ? ["risky_word"]
            : []),
          ...((text.match(/https?:\/\//g)?.length ?? 0) > 2 ||
          recent.some((r) => r.text === text)
            ? ["spam"]
            : []),
        ];
        const [c] = await tx
          .insert(comments)
          .values({
            articleId: a!.id,
            userId: u!.id,
            parentId: body.parentId ?? null,
            text,
            status: flags.length ? "flagged_pending" : "published",
            flags,
          })
          .returning();
        await notifyReply(tx, c!);
        return {
          comment: { id: c!.id, status: c!.status },
          message: flags.length ? "ความคิดเห็นรอการตรวจสอบ" : "ส่งความคิดเห็นแล้ว",
        };
      });
    },
    {
      params: slugParams,
      body: t.Object({
        text: t.String({ minLength: 1, maxLength: 3000 }),
        parentId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  );
