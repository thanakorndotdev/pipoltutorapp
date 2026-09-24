import { Elysia, t } from "elysia";
import { and, asc, count, eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import { attempts, examPacks, packProducts, packQuestions, products, questions } from "../../db/schema";
import { adminGuard } from "./guard";

const packBody = t.Object({
  slug: t.String({ minLength: 1, maxLength: 80, pattern: "^[a-z0-9-]+$" }),
  title: t.String({ minLength: 1, maxLength: 160 }),
  /** Products that unlock the pack; empty means free. */
  productIds: t.Array(t.String({ format: "uuid" }), { maxItems: 20 }),
  questionCount: t.Integer({ minimum: 1, maximum: 500 }),
  /** Minutes are friendlier in the form; stored as seconds. */
  durationSeconds: t.Integer({ minimum: 60, maximum: 6 * 3600 }),
});

const packColumns = {
  id: examPacks.id,
  slug: examPacks.slug,
  title: examPacks.title,
  questionCount: examPacks.questionCount,
  durationSeconds: examPacks.durationSeconds,
  createdAt: examPacks.createdAt,
};

const idParam = t.Object({ id: t.String({ format: "uuid" }) });

/** Unlocking products per pack, as { id, title } so the list can label them. */
async function unlocksFor(packIds: string[]) {
  const map = new Map<string, { id: string; title: string }[]>();
  if (packIds.length === 0) return map;
  const rows = await db
    .select({ packId: packProducts.packId, id: products.id, title: products.title })
    .from(packProducts)
    .innerJoin(products, eq(products.id, packProducts.productId))
    .where(inArray(packProducts.packId, packIds))
    .orderBy(asc(products.priceSatang));
  for (const { packId, ...product } of rows) map.set(packId, [...(map.get(packId) ?? []), product]);
  return map;
}

async function packWithCounts(id: string) {
  const [pack] = await db.select(packColumns).from(examPacks).where(eq(examPacks.id, id)).limit(1);
  if (!pack) return null;
  const [[assigned], [attemptCount], unlocks] = await Promise.all([
    db.select({ n: count() }).from(packQuestions).where(eq(packQuestions.packId, id)),
    db.select({ n: count() }).from(attempts).where(eq(attempts.packId, id)),
    unlocksFor([id]),
  ]);
  const unlockedBy = unlocks.get(id) ?? [];
  return {
    ...pack,
    productIds: unlockedBy.map((p) => p.id),
    unlockedBy,
    assigned: Number(assigned?.n ?? 0),
    attempts: Number(attemptCount?.n ?? 0),
  };
}

/** Every id must be an active, non-fortune product; returns an error message or null. */
async function validateProductIds(ids: string[]) {
  if (new Set(ids).size !== ids.length) return "มีสินค้าซ้ำ";
  if (ids.length === 0) return null;
  const found = await db
    .select({ id: products.id, kind: products.kind })
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.active, true)));
  if (found.length !== ids.length) return "มีสินค้าที่ไม่พบหรือปิดขายอยู่";
  if (found.some((p) => p.kind === "fortune")) return "สินค้าดูดวงปลดล็อกชุดข้อสอบไม่ได้";
  return null;
}

async function replaceUnlocks(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], packId: string, ids: string[]) {
  await tx.delete(packProducts).where(eq(packProducts.packId, packId));
  if (ids.length > 0) await tx.insert(packProducts).values(ids.map((productId) => ({ packId, productId })));
}

export const adminPacksRoutes = new Elysia({ prefix: "/admin/packs" })
  .use(adminGuard)
  .get("/", async () => {
    const rows = await db
      .select({ ...packColumns, assigned: count(packQuestions.id) })
      .from(examPacks)
      .leftJoin(packQuestions, eq(packQuestions.packId, examPacks.id))
      .groupBy(examPacks.id)
      .orderBy(asc(examPacks.title));
    const unlocks = await unlocksFor(rows.map((r) => r.id));
    return {
      packs: rows.map((r) => {
        const unlockedBy = unlocks.get(r.id) ?? [];
        return { ...r, assigned: Number(r.assigned), productIds: unlockedBy.map((p) => p.id), unlockedBy };
      }),
    };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const invalid = await validateProductIds(body.productIds);
      if (invalid) {
        set.status = 422;
        return { error: invalid };
      }
      const pack = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(examPacks)
          .values({
            slug: body.slug,
            title: body.title.trim(),
            questionCount: body.questionCount,
            durationSeconds: body.durationSeconds,
          })
          .onConflictDoNothing({ target: examPacks.slug })
          .returning({ id: examPacks.id });
        if (!created) return null;
        await replaceUnlocks(tx, created.id, body.productIds);
        return created;
      });
      if (!pack) {
        set.status = 409;
        return { error: "slug นี้มีอยู่แล้ว" };
      }
      set.status = 201;
      return { pack: await packWithCounts(pack.id) };
    },
    { body: packBody }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const pack = await packWithCounts(params.id);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      return { pack };
    },
    { params: idParam }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const invalid = await validateProductIds(body.productIds);
      if (invalid) {
        set.status = 422;
        return { error: invalid };
      }
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(examPacks)
          .set({
            slug: body.slug,
            title: body.title.trim(),
            questionCount: body.questionCount,
            durationSeconds: body.durationSeconds,
          })
          .where(eq(examPacks.id, params.id))
          .returning({ id: examPacks.id });
        if (!row) return null;
        await replaceUnlocks(tx, row.id, body.productIds);
        return row;
      });
      if (!updated) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      return { pack: await packWithCounts(params.id) };
    },
    { params: idParam, body: packBody }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [used] = await db.select({ n: count() }).from(attempts).where(eq(attempts.packId, params.id));
      if (Number(used?.n ?? 0) > 0) {
        set.status = 409;
        return { error: "มีนักเรียนทำชุดนี้ไปแล้ว ลบไม่ได้" };
      }
      const deleted = await db.delete(examPacks).where(eq(examPacks.id, params.id)).returning({ id: examPacks.id });
      if (deleted.length === 0) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      return { ok: true };
    },
    { params: idParam }
  )
  /** Ordered composition, with the full admin question rows. */
  .get(
    "/:id/questions",
    async ({ params, set }) => {
      const pack = await packWithCounts(params.id);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      const rows = await db
        .select({
          position: packQuestions.position,
          id: questions.id,
          subject: questions.subject,
          topic: questions.topic,
          prompt: questions.prompt,
          imageUrl: questions.imageUrl,
          choices: questions.choices,
          correctChoice: questions.correctChoice,
          active: questions.active,
        })
        .from(packQuestions)
        .innerJoin(questions, eq(questions.id, packQuestions.questionId))
        .where(eq(packQuestions.packId, params.id))
        .orderBy(asc(packQuestions.position));
      return { pack, questions: rows };
    },
    { params: idParam }
  )
  /**
   * Replace the composition. Order of `questionIds` is the position order.
   * Runs in one transaction so a failed validation leaves the pack untouched.
   */
  .put(
    "/:id/questions",
    async ({ params, body, set }) => {
      const ids = body.questionIds;
      if (new Set(ids).size !== ids.length) {
        set.status = 422;
        return { error: "มีข้อซ้ำในชุด" };
      }
      const pack = await packWithCounts(params.id);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      if (ids.length > 0) {
        const found = await db
          .select({ id: questions.id, active: questions.active })
          .from(questions)
          .where(inArray(questions.id, ids));
        if (found.length !== ids.length) {
          set.status = 422;
          return { error: "มีข้อที่ไม่พบในคลังข้อสอบ" };
        }
        const inactive = found.filter((q) => !q.active);
        if (inactive.length > 0) {
          set.status = 422;
          return { error: `มีข้อที่ปิดใช้งานอยู่ ${inactive.length} ข้อ เปิดใช้งานก่อน` };
        }
      }
      await db.transaction(async (tx) => {
        await tx.delete(packQuestions).where(eq(packQuestions.packId, params.id));
        if (ids.length > 0) {
          await tx.insert(packQuestions).values(
            ids.map((questionId, i) => ({ packId: params.id, questionId, position: i + 1 }))
          );
        }
      });
      return { pack: await packWithCounts(params.id) };
    },
    {
      params: idParam,
      body: t.Object({ questionIds: t.Array(t.String({ format: "uuid" }), { maxItems: 500 }) }),
    }
  );
