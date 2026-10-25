import { Elysia, t } from "elysia";
import { and, asc, count, eq, gt, inArray, sql } from "drizzle-orm";

import { db } from "../../db";
import { attempts, examPacks, packQuestions, questions } from "../../db/schema";
import { adminGuard } from "./guard";

const packBody = t.Object({
  slug: t.String({ minLength: 1, maxLength: 80, pattern: "^[a-z0-9-]+$" }),
  title: t.String({ minLength: 1, maxLength: 160 }),
  /** คำชี้แจง shown before the timer starts. */
  description: t.Optional(t.Nullable(t.String({ maxLength: 8000 }))),
  questionCount: t.Integer({ minimum: 1, maximum: 500 }),
  /** Minutes are friendlier in the form; stored as seconds. */
  durationSeconds: t.Integer({ minimum: 60, maximum: 6 * 3600 }),
  /** null = unlimited. */
  maxAttempts: t.Nullable(t.Integer({ minimum: 1, maximum: 100 })),
  /** ISO 8601 with offset; null = no bound. */
  opensAt: t.Nullable(t.String({ format: "date-time" })),
  closesAt: t.Nullable(t.String({ format: "date-time" })),
  published: t.Boolean(),
  showReview: t.Boolean(),
  /** PDF of the paper (e.g. a Google Drive link); https only. */
  paperUrl: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
});

const packColumns = {
  id: examPacks.id,
  slug: examPacks.slug,
  title: examPacks.title,
  description: examPacks.description,
  questionCount: examPacks.questionCount,
  durationSeconds: examPacks.durationSeconds,
  maxAttempts: examPacks.maxAttempts,
  opensAt: examPacks.opensAt,
  closesAt: examPacks.closesAt,
  published: examPacks.published,
  showReview: examPacks.showReview,
  paperUrl: examPacks.paperUrl,
  createdAt: examPacks.createdAt,
};

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Form body to row values, or an error message. */
function packValues(body: typeof packBody.static) {
  const opensAt = body.opensAt ? new Date(body.opensAt) : null;
  const closesAt = body.closesAt ? new Date(body.closesAt) : null;
  if (opensAt && closesAt && closesAt <= opensAt) return { error: "เวลาปิดรับต้องหลังเวลาเปิดสอบ" };
  // Omitted = leave as is, so older scripts that PUT the full row keep the link.
  const paperUrl = body.paperUrl === undefined ? undefined : body.paperUrl?.trim() || null;
  if (paperUrl && !isHttpsUrl(paperUrl)) return { error: "ลิงก์ PDF ต้องขึ้นต้นด้วย https://" };
  return {
    values: {
      slug: body.slug,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      questionCount: body.questionCount,
      durationSeconds: body.durationSeconds,
      maxAttempts: body.maxAttempts,
      opensAt,
      closesAt,
      published: body.published,
      showReview: body.showReview,
      ...(paperUrl === undefined ? {} : { paperUrl }),
    },
  };
}

/** Attempts still running on a pack; structure changes wait until they finish. */
async function liveAttempts(packId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(attempts)
    .where(and(eq(attempts.packId, packId), eq(attempts.status, "in_progress"), gt(attempts.expiresAt, new Date())));
  return Number(row?.n ?? 0);
}

const idParam = t.Object({ id: t.String({ format: "uuid" }) });

async function packWithCounts(id: string) {
  const [pack] = await db.select(packColumns).from(examPacks).where(eq(examPacks.id, id)).limit(1);
  if (!pack) return null;
  const [[assigned], [attemptCount], live] = await Promise.all([
    db.select({ n: count() }).from(packQuestions).where(eq(packQuestions.packId, id)),
    db.select({ n: count() }).from(attempts).where(eq(attempts.packId, id)),
    liveAttempts(id),
  ]);
  return {
    ...pack,
    assigned: Number(assigned?.n ?? 0),
    attempts: Number(attemptCount?.n ?? 0),
    liveAttempts: live,
  };
}

export const adminPacksRoutes = new Elysia({ prefix: "/admin/packs" })
  .use(adminGuard)
  .get("/", async () => {
    const rows = await db
      .select({
        ...packColumns,
        assigned: count(packQuestions.id),
        totalPoints: sql<number>`coalesce(sum(${questions.points}), 0)`,
        // Fully qualified: drizzle strips table names inside a scalar subquery.
        attempts: sql<number>`(select count(*) from attempts a where a.pack_id = exam_packs.id)`,
      })
      .from(examPacks)
      .leftJoin(packQuestions, eq(packQuestions.packId, examPacks.id))
      .leftJoin(questions, eq(questions.id, packQuestions.questionId))
      .groupBy(examPacks.id)
      .orderBy(asc(examPacks.title));
    return {
      packs: rows.map((r) => ({ ...r, assigned: Number(r.assigned), totalPoints: Number(r.totalPoints), attempts: Number(r.attempts) })),
    };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const checked = packValues(body);
      if ("error" in checked) {
        set.status = 422;
        return { error: checked.error };
      }
      const [pack] = await db
        .insert(examPacks)
        .values(checked.values)
        .onConflictDoNothing({ target: examPacks.slug })
        .returning({ id: examPacks.id });
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
      const checked = packValues(body);
      if ("error" in checked) {
        set.status = 422;
        return { error: checked.error };
      }
      // An open attempt's deadline was fixed at start, so a new duration or
      // closing time applies to attempts started from now on.
      const [updated] = await db
        .update(examPacks)
        .set(checked.values)
        .where(eq(examPacks.id, params.id))
        .returning({ id: examPacks.id });
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
        return { error: "มีนักเรียนทำชุดนี้ไปแล้ว ลบไม่ได้ ซ่อนชุดแทน (ปิด “เผยแพร่”) ประวัติจะยังอยู่" };
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
          section: packQuestions.section,
          id: questions.id,
          subject: questions.subject,
          topic: questions.topic,
          type: questions.type,
          points: questions.points,
          prompt: questions.prompt,
          imageUrl: questions.imageUrl,
          choices: questions.choices,
          correctChoices: questions.correctChoices,
          acceptedAnswers: questions.acceptedAnswers,
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
   * Replace the composition. Order of `items` is the position order; each
   * item may carry a ตอน label. Refused while a student is mid-attempt, since
   * adding, removing or moving questions under a running exam would shift
   * what their saved answers point at. Wording and key fixes go through the
   * question editor instead and are picked up by grading or a regrade.
   */
  .put(
    "/:id/questions",
    async ({ params, body, set }) => {
      const ids = body.items.map((i) => i.questionId);
      if (new Set(ids).size !== ids.length) {
        set.status = 422;
        return { error: "มีข้อซ้ำในชุด" };
      }
      const pack = await packWithCounts(params.id);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      if (pack.liveAttempts > 0) {
        set.status = 409;
        return { error: `มีนักเรียนกำลังทำชุดนี้อยู่ ${pack.liveAttempts} คน ปรับโครงสร้างชุดได้เมื่อทุกคนส่งแล้ว (แก้ข้อความ/เฉลยในคลังข้อสอบได้ตามปกติ)` };
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
            body.items.map((item, i) => ({
              packId: params.id,
              questionId: item.questionId,
              position: i + 1,
              section: item.section?.trim() || null,
            }))
          );
        }
      });
      return { pack: await packWithCounts(params.id) };
    },
    {
      params: idParam,
      body: t.Object({
        items: t.Array(
          t.Object({
            questionId: t.String({ format: "uuid" }),
            section: t.Optional(t.Nullable(t.String({ maxLength: 120 }))),
          }),
          { maxItems: 500 }
        ),
      }),
    }
  );
