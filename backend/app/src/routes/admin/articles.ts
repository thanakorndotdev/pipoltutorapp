import { randomBytes } from "node:crypto";
import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { articles } from "../../db/schema";
import {
  articleRedirects,
  articleRevisions,
  categories,
  comments,
  articleEvents,
  featureSettings,
} from "../../db/features";
import { actorOf } from "../../audit";
import { authorize, staffRole } from "../../permissions";
import {
  auditTx,
  consumePreview,
  fail,
  hash,
  lock,
  preview,
  safeUrl,
} from "../../features/common";
import {
  notifyReply,
  parseBlocks,
  revision,
  settings,
  type ArticleRow,
} from "../../features/cms";
import { adminGuard } from "./guard";
const params = t.Object({ id: t.String({ format: "uuid" }) });
const reason = t.String({ minLength: 3, maxLength: 500 });
const editable = {
  title: t.String({ minLength: 1, maxLength: 200 }),
  excerpt: t.Nullable(t.String({ maxLength: 400 })),
  coverUrl: t.Nullable(t.String({ maxLength: 2000 })),
  blocks: t.Unknown(),
  published: t.Optional(t.Boolean()),
  slug: t.Optional(
    t.Nullable(t.String({ maxLength: 120, pattern: "^[a-z0-9-]*$" })),
  ),
  kind: t.Optional(t.Union([t.Literal("lesson"), t.Literal("news")])),
  levels: t.Optional(
    t.Array(t.Union([t.Literal("m1"), t.Literal("m4")]), { uniqueItems: true }),
  ),
  subjects: t.Optional(t.Array(t.String({ maxLength: 120 }), { maxItems: 20 })),
  categoryIds: t.Optional(
    t.Array(t.String({ format: "uuid" }), { maxItems: 30 }),
  ),
  tags: t.Optional(t.Array(t.String({ maxLength: 60 }), { maxItems: 30 })),
  sourceUrl: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
  sourceCredit: t.Optional(t.Nullable(t.String({ maxLength: 300 }))),
  sourceDate: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
  deadline: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
  viewMode: t.Optional(
    t.Union([t.Literal("none"), t.Literal("views"), t.Literal("popular")]),
  ),
  baseRevision: t.Optional(t.Integer({ minimum: 0 })),
};
async function canEdit(
  headers: Record<string, string | undefined>,
  a: ArticleRow,
) {
  const u = await authorize(headers, "article", "write");
  if (u && staffRole(u) === "author" && a.authorId !== u.id)
    fail("ไม่พบบทความ", 404);
  return u;
}
async function normalise(body: typeof input.static) {
  if (
    (body.coverUrl && !safeUrl(body.coverUrl, true)) ||
    (body.sourceUrl && !safeUrl(body.sourceUrl, true))
  )
    fail("URL ต้องเป็น https หรือไฟล์อัปโหลด");
  if (body.categoryIds?.length) {
    const found = await db
      .select()
      .from(categories)
      .where(inArray(categories.id, body.categoryIds));
    if (found.length !== body.categoryIds.length) fail("ไม่พบหมวดที่เลือก");
  }
  return {
    title: body.title.trim(),
    excerpt: body.excerpt?.trim() || null,
    coverUrl: body.coverUrl,
    blocks: parseBlocks(body.blocks),
    kind: body.kind,
    levels: body.levels,
    subjects: body.subjects,
    categoryIds: body.categoryIds,
    tags: body.tags,
    sourceUrl: body.sourceUrl,
    sourceCredit: body.sourceCredit,
    sourceDate: body.sourceDate,
    deadline:
      body.deadline === undefined
        ? undefined
        : body.deadline === null
          ? null
          : new Date(body.deadline),
    viewMode: body.viewMode,
  };
}
const input = t.Object(editable);
export const adminArticlesRoutes = new Elysia({ prefix: "/admin/articles" })
  .use(adminGuard)
  .get("/", async ({ headers }) => {
    const u = await authorize(headers, "article", "read");
    return {
      articles: await db
        .select()
        .from(articles)
        .where(
          u && staffRole(u) === "author"
            ? eq(articles.authorId, u.id)
            : undefined,
        )
        .orderBy(desc(articles.createdAt))
        .limit(500),
    };
  })
  .get(
    "/:id",
    async ({ params, headers }) => {
      const [a] = await db
        .select()
        .from(articles)
        .where(eq(articles.id, params.id));
      if (!a) fail("ไม่พบบทความ", 404);
      const u = await authorize(headers, "article", "read");
      if (u && staffRole(u) === "author" && a!.authorId !== u.id)
        fail("ไม่พบบทความ", 404);
      return {
        article: a,
        revisions: await db
          .select()
          .from(articleRevisions)
          .where(eq(articleRevisions.articleId, params.id))
          .orderBy(desc(articleRevisions.version))
          .limit(100),
      };
    },
    { params },
  )
  .post(
    "/",
    async ({ body, headers, set }) => {
      const actor = await actorOf(headers);
      const v = await normalise(body);
      return db.transaction(async (tx) => {
        const slug =
          body.slug?.trim() || `article-${randomBytes(6).toString("hex")}`;
        const [used] = await tx
          .select()
          .from(articleRedirects)
          .where(eq(articleRedirects.slug, slug));
        if (used) fail("slug นี้เคยใช้งานแล้ว", 409);
        const [a] = await tx
          .insert(articles)
          .values({
            ...v,
            slug,
            authorId: actor.id,
            published: false,
            workflow: "draft",
          })
          .onConflictDoNothing()
          .returning();
        if (!a) fail("slug นี้มีบทความแล้ว", 409);
        await revision(tx, a!, actor, "create");
        set.status = 201;
        return { article: { ...a!, revision: 1 } };
      });
    },
    { body: input },
  )
  .put(
    "/:id",
    async ({ params, body, headers }) => {
      const v = await normalise(body);
      return db.transaction(async (tx) => {
        await lock(tx, `article:${params.id}`);
        const [a] = await tx
          .select()
          .from(articles)
          .where(eq(articles.id, params.id))
          .for("update");
        if (!a) fail("ไม่พบบทความ", 404);
        await canEdit(headers, a!);
        if (
          body.baseRevision !== undefined &&
          body.baseRevision !== a!.revision
        )
          fail("บทความมีการแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่", 409);
        const slug = body.slug?.trim() || a!.slug;
        if (slug !== a!.slug) {
          await authorize(headers, "article", "publish");
          const [used] = await tx
            .select()
            .from(articleRedirects)
            .where(eq(articleRedirects.slug, slug));
          if (used) fail("slug นี้เคยใช้งานแล้ว", 409);
          await tx
            .insert(articleRedirects)
            .values({ slug: a!.slug, articleId: a!.id });
        }
        const [after] = await tx
          .update(articles)
          .set({
            ...v,
            slug,
            workflow: "draft",
            approvedBy: null,
            scheduledAt: null,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, a!.id))
          .returning();
        await revision(tx, after!, await actorOf(headers), "save");
        return { article: { ...after!, revision: after!.revision + 1 } };
      });
    },
    { params, body: input },
  )
  .post(
    "/:id/workflow",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, `article:${params.id}`);
        const [a] = await tx
          .select()
          .from(articles)
          .where(eq(articles.id, params.id))
          .for("update");
        if (!a) fail("ไม่พบบทความ", 404);
        const actor = await actorOf(headers);
        await canEdit(headers, a!);
        if (body.baseRevision !== a!.revision)
          fail("ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่", 409);
        if (body.action !== "submit")
          await authorize(headers, "article", "publish");
        let patch: Partial<ArticleRow> = { updatedAt: new Date() };
        if (body.action === "submit") {
          if (a!.workflow !== "draft") fail("ส่งตรวจได้เฉพาะฉบับร่าง", 409);
          patch.workflow = "in_review";
        }
        if (body.action === "approve") {
          if (a!.workflow !== "in_review") fail("ต้องส่งตรวจบทความก่อนอนุมัติ", 409);
          patch = { ...patch, workflow: "approved", approvedBy: actor.id };
        }
        if (body.action === "schedule") {
          if (
            a!.workflow !== "approved" ||
            !body.scheduledAt ||
            new Date(body.scheduledAt) <= new Date()
          )
            fail("ต้องอนุมัติและกำหนดเวลาในอนาคต");
          patch = {
            ...patch,
            workflow: "scheduled",
            scheduledAt: new Date(body.scheduledAt!),
          };
        }
        if (body.action === "publish") {
          if (a!.workflow !== "approved") fail("ต้องอนุมัติก่อนเผยแพร่", 409);
          patch = {
            ...patch,
            published: true,
            workflow: "published",
            publishedAt: a!.publishedAt ?? new Date(),
            scheduledAt: null,
          };
          patch.publishedSnapshot = {
            ...a!,
            ...patch,
            publishedSnapshot: null,
          };
        }
        if (body.action === "archive" || body.action === "delete")
          patch = {
            ...patch,
            published: false,
            workflow: body.action === "archive" ? "archived" : "deleted",
            scheduledAt: null,
          };
        if (body.action === "restore")
          patch = {
            ...patch,
            workflow: "draft",
            published: false,
            approvedBy: null,
          };
        const [after] = await tx
          .update(articles)
          .set(patch)
          .where(eq(articles.id, params.id))
          .returning();
        await revision(tx, after!, actor, body.action);
        return { article: { ...after!, revision: after!.revision + 1 } };
      }),
    {
      params,
      body: t.Object({
        action: t.Union([
          t.Literal("submit"),
          t.Literal("approve"),
          t.Literal("schedule"),
          t.Literal("publish"),
          t.Literal("archive"),
          t.Literal("delete"),
          t.Literal("restore"),
        ]),
        baseRevision: t.Integer({ minimum: 0 }),
        scheduledAt: t.Optional(t.String({ format: "date-time" })),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, headers }) =>
      db.transaction(async (tx) => {
        const [a] = await tx
          .select()
          .from(articles)
          .where(eq(articles.id, params.id))
          .for("update");
        if (!a) fail("ไม่พบบทความ", 404);
        await canEdit(headers, a!);
        await authorize(headers, "article", "publish");
        const [after] = await tx
          .update(articles)
          .set({ workflow: "deleted", published: false })
          .where(eq(articles.id, params.id))
          .returning();
        await revision(tx, after!, await actorOf(headers), "delete");
        return { ok: true };
      }),
    { params },
  );

export const adminCmsRoutes = new Elysia({ prefix: "/admin/cms" })
  .use(adminGuard)
  .get("/", async () => ({
    categories: await db
      .select()
      .from(categories)
      .orderBy(categories.sortOrder),
    synonyms: await settings("cms.synonyms", {}),
    moderationWords: await settings("cms.moderationWords", []),
    home: await settings("cms.home", []),
    events: await db
      .select({
        articleId: articleEvents.articleId,
        kind: articleEvents.kind,
        referrer: articleEvents.referrer,
        count: sql<number>`count(*)::int`,
      })
      .from(articleEvents)
      .groupBy(
        articleEvents.articleId,
        articleEvents.kind,
        articleEvents.referrer,
      ),
  }))
  .post(
    "/categories",
    async ({ body, headers }) =>
      db.transaction(async (tx) => {
        if (body.parentId) {
          const [p] = await tx
            .select()
            .from(categories)
            .where(eq(categories.id, body.parentId));
          if (!p) fail("ไม่พบหมวดหลัก");
        }
        const [c] = await tx.insert(categories).values(body).returning();
        await auditTx(tx, await actorOf(headers), {
          action: "taxonomy.create",
          module: "article",
          targetId: c!.id,
          after: c,
        });
        return { category: c };
      }),
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 120 }),
        kind: t.Union([
          t.Literal("subject"),
          t.Literal("category"),
          t.Literal("chapter"),
          t.Literal("topic"),
        ]),
        slug: t.String({
          minLength: 1,
          maxLength: 80,
          pattern: "^[a-z0-9-]+$",
        }),
        parentId: t.Nullable(t.String({ format: "uuid" })),
        sortOrder: t.Integer({ minimum: 0, maximum: 100000 }),
      }),
    },
  )
  .put(
    "/categories/:id",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, "taxonomy");
        if (body.parentId === params.id) fail("หมวดไม่สามารถเป็นหมวดหลักของตัวเอง");
        if (body.parentId) {
          const all = await tx.select().from(categories);
          let parent = body.parentId;
          const visited = new Set([params.id]);
          while (parent) {
            if (visited.has(parent)) fail("โครงสร้างหมวดวนซ้ำ");
            visited.add(parent);
            const p = all.find((c) => c.id === parent);
            if (!p) fail("ไม่พบหมวดหลัก");
            parent = p!.parentId ?? "";
          }
        }
        const [after] = await tx
          .update(categories)
          .set(body)
          .where(eq(categories.id, params.id))
          .returning();
        if (!after) fail("ไม่พบหมวด", 404);
        await auditTx(tx, await actorOf(headers), {
          action: "taxonomy.update",
          module: "article",
          targetId: params.id,
          after,
        });
        return { category: after };
      }),
    {
      params,
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 120 }),
        parentId: t.Nullable(t.String({ format: "uuid" })),
        sortOrder: t.Integer({ minimum: 0, maximum: 100000 }),
      }),
    },
  )
  .delete(
    "/categories/:id",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, "taxonomy");
        const [before] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, params.id));
        if (!before) fail("ไม่พบหมวด", 404);
        const children = await tx
          .select()
          .from(categories)
          .where(eq(categories.parentId, params.id));
        const used = await tx
          .select({ id: articles.id })
          .from(articles)
          .where(sql`${params.id}::uuid = any(${articles.categoryIds})`);
        if (children.length || used.length)
          fail("หมวดนี้ยังมีหมวดย่อยหรือบทความ กรุณาย้ายหรือรวมหมวดก่อนลบ", 409);
        await tx.delete(categories).where(eq(categories.id, params.id));
        await auditTx(tx, await actorOf(headers), {
          action: "taxonomy.delete",
          module: "article",
          targetId: params.id,
          before,
          reason: body.reason,
        });
        return { deleted: true };
      }),
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({ reason }),
    },
  )
  .post(
    "/merge/preview",
    async ({ body, headers }) => {
      if (body.from === body.to) fail("เลือกคนละหมวด");
      const all = await db.select().from(categories);
      if (
        !all.some((c) => c.id === body.from) ||
        !all.some((c) => c.id === body.to)
      )
        fail("ไม่พบหมวด");
      let ancestor: string | null = body.to;
      while (ancestor) {
        if (ancestor === body.from) fail("ไม่สามารถรวมหมวดแม่เข้าหมวดลูกได้");
        ancestor = all.find((c) => c.id === ancestor)?.parentId ?? null;
      }
      const affected = await db
        .select({
          id: articles.id,
          title: articles.title,
          revision: articles.revision,
        })
        .from(articles)
        .where(sql`${body.from}::uuid = any(${articles.categoryIds})`);
      return {
        ...(await preview(
          "taxonomy",
          "merge",
          await actorOf(headers),
          hash({ all, affected }),
          body,
        )),
        affected,
      };
    },
    {
      body: t.Object({
        from: t.String({ format: "uuid" }),
        to: t.String({ format: "uuid" }),
        reason,
      }),
    },
  )
  .post(
    "/merge/commit",
    async ({ body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, "taxonomy");
        const actor = await actorOf(headers);
        const { actionPreviews } = await import("../../db/features");
        const [p] = await tx
          .select()
          .from(actionPreviews)
          .where(eq(actionPreviews.id, body.previewId));
        const candidate = p?.payload as
          { from: string; to: string } | undefined;
        if (!candidate) fail("ไม่พบตัวอย่าง", 404);
        const all = await tx.select().from(categories);
        const affected = await tx
          .select({
            id: articles.id,
            title: articles.title,
            revision: articles.revision,
          })
          .from(articles)
          .where(sql`${candidate!.from}::uuid = any(${articles.categoryIds})`);
        const plan = (await consumePreview(
          tx,
          body.previewId,
          "taxonomy",
          "merge",
          actor,
          hash({ all, affected }),
        )) as { from: string; to: string; reason: string };
        for (const item of affected) {
          const [a] = await tx
            .select()
            .from(articles)
            .where(eq(articles.id, item.id));
          const ids = [
            ...new Set(
              a!.categoryIds.map((id) => (id === plan.from ? plan.to : id)),
            ),
          ];
          const ps = a!.publishedSnapshot as ArticleRow | null;
          const [after] = await tx
            .update(articles)
            .set({
              categoryIds: ids,
              ...(ps
                ? {
                    publishedSnapshot: {
                      ...ps,
                      categoryIds: [
                        ...new Set(
                          ps.categoryIds.map((id) =>
                            id === plan.from ? plan.to : id,
                          ),
                        ),
                      ],
                    },
                  }
                : {}),
            })
            .where(eq(articles.id, item.id))
            .returning();
          await revision(tx, after!, actor, "taxonomy_merge");
        }
        await tx
          .update(categories)
          .set({ parentId: plan.to })
          .where(eq(categories.parentId, plan.from));
        await tx
          .insert(featureSettings)
          .values({ key: `taxonomy.alias.${plan.from}`, value: plan.to })
          .onConflictDoUpdate({
            target: featureSettings.key,
            set: { value: plan.to },
          });
        await tx.delete(categories).where(eq(categories.id, plan.from));
        await auditTx(tx, actor, {
          action: "taxonomy.merge",
          module: "article",
          after: plan,
          reason: plan.reason,
          sourceId: body.previewId,
        });
        return { affected: affected.length };
      }),
    { body: t.Object({ previewId: t.String({ format: "uuid" }) }) },
  )
  .put(
    "/settings",
    async ({ body, headers }) =>
      db.transaction(async (tx) => {
        await authorize(headers, "article", "publish");
        for (const [key, value] of Object.entries(body)) {
          await tx
            .insert(featureSettings)
            .values({ key: `cms.${key}`, value })
            .onConflictDoUpdate({
              target: featureSettings.key,
              set: {
                value,
                version: sql`${featureSettings.version}+1`,
                updatedAt: new Date(),
              },
            });
        }
        await auditTx(tx, await actorOf(headers), {
          action: "cms.settings",
          module: "article",
          after: body,
        });
        return { ok: true };
      }),
    {
      body: t.Object({
        synonyms: t.Record(
          t.String({ maxLength: 120 }),
          t.Array(t.String({ maxLength: 120 }), { maxItems: 20 }),
        ),
        moderationWords: t.Array(t.String({ maxLength: 100 }), {
          maxItems: 500,
        }),
        home: t.Array(
          t.Object({
            key: t.Union([
              t.Literal("hero"),
              t.Literal("news"),
              t.Literal("lessons"),
              t.Literal("courses"),
              t.Literal("exams"),
              t.Literal("daily"),
            ]),
            enabled: t.Boolean(),
            articleIds: t.Array(t.String({ format: "uuid" }), { maxItems: 20 }),
          }),
          { maxItems: 6 },
        ),
      }),
    },
  );

export const adminCommentsRoutes = new Elysia({ prefix: "/admin/comments" })
  .use(adminGuard)
  .get(
    "/",
    async ({ query }) => ({
      comments: await db
        .select()
        .from(comments)
        .where(query.status ? eq(comments.status, query.status) : undefined)
        .orderBy(desc(comments.createdAt))
        .limit(500),
    }),
    { query: t.Object({ status: t.Optional(t.String({ maxLength: 30 })) }) },
  )
  .put(
    "/:id",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        const [c] = await tx
          .select()
          .from(comments)
          .where(eq(comments.id, params.id))
          .for("update");
        if (!c) fail("ไม่พบความคิดเห็น", 404);
        const status =
          body.action === "approve"
            ? "published"
            : body.action === "reject"
              ? "rejected"
              : body.action === "delete"
                ? "deleted"
                : "hidden";
        const [after] = await tx
          .update(comments)
          .set({ status, updatedAt: new Date() })
          .where(eq(comments.id, params.id))
          .returning();
        await notifyReply(tx, after!);
        await auditTx(tx, await actorOf(headers), {
          module: "comment",
          action: `comment.${body.action}`,
          targetId: params.id,
          before: c,
          after,
          reason: body.reason,
        });
        return { comment: after };
      }),
    {
      params,
      body: t.Object({
        action: t.Union([
          t.Literal("approve"),
          t.Literal("reject"),
          t.Literal("hide"),
          t.Literal("delete"),
        ]),
        reason,
      }),
    },
  );
