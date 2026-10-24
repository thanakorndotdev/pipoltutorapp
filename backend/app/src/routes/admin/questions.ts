import { Elysia, t } from "elysia";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "../../db";
import { attemptAnswers, packQuestions, questions, questionSubject, QUESTION_TYPES, SCORING_MODES } from "../../db/schema";
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
  type: t.UnionEnum(QUESTION_TYPES),
  /** Decimals allowed, e.g. 1.5 or 3.75; stored to 2 places. */
  points: t.Number({ minimum: 0, maximum: 1000 }),
  scoring: t.Optional(t.UnionEnum(SCORING_MODES)),
  /** Empty for "short". */
  choices: t.Array(choice, { maxItems: 10 }),
  correctChoices: t.Array(t.String({ minLength: 1, maxLength: 4 }), { maxItems: 10 }),
  /** Exact-match variants for "short". */
  acceptedAnswers: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 500 }), { maxItems: 20 })),
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
  type: questions.type,
  points: questions.points,
  scoring: questions.scoring,
  choices: questions.choices,
  correctChoices: questions.correctChoices,
  acceptedAnswers: questions.acceptedAnswers,
  explanation: questions.explanation,
  active: questions.active,
  createdAt: questions.createdAt,
  updatedAt: questions.updatedAt,
};

type QuestionBody = typeof questionBody.static;

/**
 * Normalise and check a question against its type. Returns the row values or
 * an error message. single: 2+ choices, exactly one key. multiple: 2+
 * choices, one or more keys. short: no choices, one or more accepted answers
 * (kept exactly as typed — no trimming, since matching is exact).
 */
function normalise(body: QuestionBody) {
  const points = Math.round(body.points * 100) / 100;
  const base = {
    subject: body.subject,
    topic: body.topic.trim(),
    prompt: body.prompt.trim(),
    imageUrl: body.imageUrl?.trim() || null,
    type: body.type,
    points,
    explanation: body.explanation?.trim() || null,
    active: body.active ?? true,
  };
  if (body.type === "short") {
    const accepted = [...new Set((body.acceptedAnswers ?? []).filter((a) => a !== ""))];
    if (accepted.length === 0) return { error: "ข้อเติมคำต้องมีคำตอบที่ยอมรับอย่างน้อย 1 แบบ" };
    return { values: { ...base, scoring: "exact" as const, choices: [], correctChoices: [], acceptedAnswers: accepted } };
  }
  const choices = body.choices.map((c) => ({ key: c.key.trim(), text: c.text.trim() }));
  const keys = choices.map((c) => c.key);
  if (choices.length < 2) return { error: "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ" };
  if (choices.some((c) => !c.key || !c.text)) return { error: "ตัวเลือกทุกข้อต้องมีตัวอักษรและข้อความ" };
  if (new Set(keys).size !== keys.length) return { error: "ตัวเลือกมีตัวอักษรซ้ำกัน" };
  const correct = [...new Set(body.correctChoices.map((k) => k.trim()))];
  if (correct.length === 0) return { error: "เลือกเฉลยอย่างน้อย 1 ตัวเลือก" };
  if (correct.some((k) => !keys.includes(k))) return { error: "เฉลยต้องตรงกับตัวเลือก" };
  if (body.type === "single" && correct.length !== 1) return { error: "ข้อปรนัยเลือกเฉลยได้ 1 ตัวเลือก" };
  return {
    values: {
      ...base,
      scoring: body.type === "multiple" ? (body.scoring ?? "exact") : ("exact" as const),
      choices,
      correctChoices: correct,
      acceptedAnswers: [],
    },
  };
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
      const checked = normalise(body);
      if ("error" in checked) {
        set.status = 422;
        return { error: checked.error };
      }
      const [question] = await db.insert(questions).values(checked.values).returning(adminColumns);
      set.status = 201;
      return { question };
    },
    { body: questionBody }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const checked = normalise(body);
      if ("error" in checked) {
        set.status = 422;
        return { error: checked.error };
      }
      // Changing the type under answers already given would make them
      // meaningless; refuse while any attempt holds an answer to it.
      const [current] = await db.select({ type: questions.type }).from(questions).where(eq(questions.id, params.id)).limit(1);
      if (current && current.type !== checked.values.type) {
        const [answered] = await db.select({ n: count() }).from(attemptAnswers).where(eq(attemptAnswers.questionId, params.id));
        if (Number(answered?.n ?? 0) > 0) {
          set.status = 409;
          return { error: "มีนักเรียนตอบข้อนี้แล้ว เปลี่ยนประเภทคำถามไม่ได้ สร้างข้อใหม่แทน" };
        }
      }
      const [question] = await db
        .update(questions)
        .set({ ...checked.values, updatedAt: new Date() })
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
