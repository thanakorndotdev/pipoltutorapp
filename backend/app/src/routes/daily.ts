import { Elysia, t } from "elysia";
import { desc, eq, sql } from "drizzle-orm";
import { currentUser } from "../auth";
import { db } from "../db";
import { dailyAssignments } from "../db/features";
import { addDays, bangkokDay, fail, validDay } from "../features/common";
import {
  correctAnswer,
  dailyView,
  extensionFor,
  getFire,
  heldDates,
  recover,
  submitDaily,
  validateAnswer,
} from "../features/daily";
const answer = t.Object({
  selectedChoices: t.Array(t.String({ maxLength: 8 }), { maxItems: 20 }),
  textAnswer: t.Nullable(t.String({ maxLength: 500 })),
});
export const dailyRoutes = new Elysia({ prefix: "/daily" })
  .get("/today", async ({ headers }) => {
    const userId = (await currentUser(headers))?.id ?? null,
      today = bangkokDay(),
      yesterday = addDays(today, -1);
    // FIRE-12 Extend can keep yesterday open past midnight for this learner.
    const until = await extensionFor(db, userId, yesterday);
    return {
      ...(await dailyView(userId, today)),
      pastExtension: until
        ? { date: yesterday, until: until.toISOString() }
        : null,
    };
  })
  .get("/fire", async ({ headers }) => {
    const u = await currentUser(headers);
    if (!u) fail("กรุณาเข้าสู่ระบบ", 401);
    return getFire(u!.id);
  })
  .post("/recover", async ({ headers }) => {
    const u = await currentUser(headers);
    if (!u) fail("กรุณาเข้าสู่ระบบ", 401);
    return recover(u!.id);
  })
  .post(
    "/submit",
    async ({ headers, body }) => {
      const u = await currentUser(headers);
      if (!u) fail("กรุณาเข้าสู่ระบบด้วย Google ก่อนทำโจทย์", 401);
      const result = await submitDaily(
        u!.id,
        body.date,
        body.questionId,
        body.answer,
        body.requestId,
      );
      return {
        ...result,
        fire: await getFire(u!.id),
        daily: await dailyView(u!.id, body.date),
      };
    },
    {
      body: t.Object({
        date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
        questionId: t.String({ maxLength: 80 }),
        requestId: t.String({ format: "uuid" }),
        answer,
      }),
    },
  )
  .get("/archive", async () => {
    const held = await heldDates(db);
    return {
    days: (
      await db
        .select({
          date: dailyAssignments.date,
          title: dailyAssignments.title,
          // 0 on a day that had no challenge; nothing to practise there.
          questions: sql<number>`jsonb_array_length(${dailyAssignments.questions})::int`,
        })
        .from(dailyAssignments)
        .orderBy(desc(dailyAssignments.date))
        .limit(366)
    ).filter((d) => d.date < bangkokDay() && !held.has(d.date)),
    };
  })
  .get(
    "/archive/:date",
    async ({ params, headers }) => {
      if (!validDay(params.date) || params.date >= bangkokDay())
        fail("ไม่พบโจทย์ย้อนหลัง", 404);
      if ((await heldDates(db)).has(params.date)) {
        // Still inside an approved extension: only covered learners may answer,
        // and nobody sees the key yet.
        const userId = (await currentUser(headers))?.id ?? null;
        if (!(await extensionFor(db, userId, params.date)))
          fail("โจทย์วันนี้อยู่ในช่วงขยายเวลา จะเปิดฝึกย้อนหลังเมื่อหมดเวลา", 404);
        return dailyView(userId, params.date);
      }
      return dailyView(null, params.date);
    },
    { params: t.Object({ date: t.String({ maxLength: 10 }) }) },
  )
  .post(
    "/archive/:date/practice",
    async ({ params, body }) => {
      if (
        !validDay(params.date) ||
        params.date >= bangkokDay() ||
        (await heldDates(db)).has(params.date)
      )
        fail("ไม่พบโจทย์ย้อนหลัง", 404);
      const [day] = await db
        .select()
        .from(dailyAssignments)
        .where(eq(dailyAssignments.date, params.date));
      const q = day?.questions.find((q) => q.id === body.questionId);
      if (!q) fail("ไม่พบโจทย์", 404);
      validateAnswer(q!, body.answer);
      return {
        correct: correctAnswer(q!, body.answer),
        explanation: q!.explanation,
        correctChoices: q!.correctChoices,
        acceptedAnswers: q!.acceptedAnswers,
        fireChanged: false,
      };
    },
    {
      params: t.Object({ date: t.String({ maxLength: 10 }) }),
      body: t.Object({ questionId: t.String({ maxLength: 80 }), answer }),
    },
  );
