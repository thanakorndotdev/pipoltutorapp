import { Elysia, t } from "elysia";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "../../db";
import { packQuestions, questions, questionSubject } from "../../db/schema";
import { adminGuard } from "./guard";

export const SUBJECTS = questionSubject.enumValues;

const choice = t.Object({
  key: t.String({ minLength: 1, maxLength: 4 }),
  text: t.String({ minLength: 1, maxLength: 2000 }),
});

const questionBody = t.Object({
  subject: t.UnionEnum(SUBJECTS),
  topic: t.String({ minLength: 1, maxLength: 120 }),
  prompt: t.String({ minLength: 1, maxLength: 4000 }),
  imageUrl: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
  choices: t.Array(choice, { minItems: 2, maxItems: 6 }),
  correctChoice: t.String({ minLength: 1, maxLength: 4 }),
  explanation: t.Optional(t.Nullable(t.String({ maxLength: 4000 }))),
  active: t.Optional(t.Boolean()),
});

/**
 * Optional enums in a query use t.Union of literals: Elysia 1.4 fills an
 * absent t.Optional(t.UnionEnum(...)) query field with its first value.
 */
const optionalEnum = <T extends readonly string[]>(values: T) =>
  t.Optional(t.Union(values.map((v) => t.Literal(v)) as unknown as [ReturnType<typeof t.Literal<T[number]>>]));

const listQuery = t.Object({
  subject: optionalEnum(SUBJECTS),
  topic: t.Optional(t.String({ maxLength: 120 })),
  q: t.Optional(t.String({ maxLength: 200 })),
  active: optionalEnum(["true", "false"] as const),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 200 })),
  offset: t.Optional(t.Integer({ minimum: 0 })),
});

/** Admin projection — includes the key. Never reuse on a student route. */
const adminColumns = {
  id: questions.id,
  subject: questions.subject,
  topic: questions.topic,
  prompt: questions.prompt,
  imageUrl: questions.imageUrl,
  choices: questions.choices,
  correctChoice: questions.correctChoice,
  explanation: questions.explanation,
  active: questions.active,
  createdAt: questions.createdAt,
  updatedAt: questions.updatedAt,
};

/** The key must match one of the choices; duplicate keys are rejected. */
function validateChoices(body: { choices: { key: string }[]; correctChoice: string }) {
  const keys = body.choices.map((c) => c.key.trim());
  if (new Set(keys).size !== keys.length) return "ตัวเลือกมีตัวอักษรซ้ำกัน";
  if (!keys.includes(body.correctChoice.trim())) return "เฉลยต้องตรงกับตัวเลือกใดตัวเลือกหนึ่ง";
  return null;
}

export const adminQuestionsRoutes = new Elysia({ prefix: "/admin/questions" })
  .use(adminGuard)
  .get(
    "/",
    async ({ query }) => {
      const conds = [];
      if (query.subject) conds.push(eq(questions.subject, query.subject));
      if (query.topic) conds.push(ilike(questions.topic, `%${query.topic}%`));
      if (query.active) conds.push(eq(questions.active, query.active === "true"));
      if (query.q) {
        const needle = `%${query.q}%`;
        conds.push(or(ilike(questions.prompt, needle), ilike(questions.topic, needle)));
      }
      const where = conds.length ? and(...conds) : undefined;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const [rows, [totals]] = await Promise.all([
        db
          .select({
            ...adminColumns,
            // Fully qualified on purpose: drizzle strips table names inside a
            // scalar subquery, and bare "id" would bind to pack_questions.id.
            usedInPacks: sql<number>`(select count(*) from pack_questions pq where pq.question_id = questions.id)`,
          })
          .from(questions)
          .where(where)
          .orderBy(desc(questions.updatedAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(questions).where(where),
      ]);
      return {
        questions: rows.map((r) => ({ ...r, usedInPacks: Number(r.usedInPacks) })),
        total: Number(totals?.total ?? 0),
        limit,
        offset,
      };
    },
    { query: listQuery }
  )
  /** Distinct topics per subject, for the filter dropdown and the editor. */
  .get("/topics", async () => {
    const rows = await db
      .select({ subject: questions.subject, topic: questions.topic, n: count() })
      .from(questions)
      .groupBy(questions.subject, questions.topic)
      .orderBy(questions.subject, questions.topic);
    return { topics: rows.map((r) => ({ ...r, n: Number(r.n) })) };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const problem = validateChoices(body);
      if (problem) {
        set.status = 422;
        return { error: problem };
      }
      const [question] = await db
        .insert(questions)
        .values({
          subject: body.subject,
          topic: body.topic.trim(),
          prompt: body.prompt.trim(),
          imageUrl: body.imageUrl?.trim() || null,
          choices: body.choices.map((c) => ({ key: c.key.trim(), text: c.text.trim() })),
          correctChoice: body.correctChoice.trim(),
          explanation: body.explanation?.trim() || null,
          active: body.active ?? true,
        })
        .returning(adminColumns);
      set.status = 201;
      return { question };
    },
    { body: questionBody }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const problem = validateChoices(body);
      if (problem) {
        set.status = 422;
        return { error: problem };
      }
      const [question] = await db
        .update(questions)
        .set({
          subject: body.subject,
          topic: body.topic.trim(),
          prompt: body.prompt.trim(),
          imageUrl: body.imageUrl?.trim() || null,
          choices: body.choices.map((c) => ({ key: c.key.trim(), text: c.text.trim() })),
          correctChoice: body.correctChoice.trim(),
          explanation: body.explanation?.trim() || null,
          active: body.active ?? true,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, params.id))
        .returning(adminColumns);
      if (!question) {
        set.status = 404;
        return { error: "ไม่พบข้อสอบ" };
      }
      return { question };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }), body: questionBody }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [used] = await db
        .select({ n: count() })
        .from(packQuestions)
        .where(eq(packQuestions.questionId, params.id));
      if (Number(used?.n ?? 0) > 0) {
        set.status = 409;
        return { error: "ข้อนี้ยังอยู่ในชุดข้อสอบ เอาออกจากชุดก่อนจึงลบได้" };
      }
      const deleted = await db
        .delete(questions)
        .where(eq(questions.id, params.id))
        .returning({ id: questions.id });
      if (deleted.length === 0) {
        set.status = 404;
        return { error: "ไม่พบข้อสอบ" };
      }
      return { ok: true };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  );
