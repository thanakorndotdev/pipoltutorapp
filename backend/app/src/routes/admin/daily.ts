import { randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
import { and, count, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { questions } from "../../db/schema";
import {
  dailyAssignments,
  dailyChallenges,
  dailyExtensions,
  dailyResponses,
  dailyRevisions,
  fireLedger,
  fireRecovery,
  fireSummary,
  type DailyQuestion,
} from "../../db/features";
import { actorOf, audit } from "../../audit";
import { adminColumns, normalise, questionBody } from "./questions";
import {
  addDays,
  auditTx,
  bangkokDay,
  consumePreview,
  endOfDay,
  fail,
  hash,
  lock,
  preview,
  validDay,
} from "../../features/common";
import { correctAnswer, settleFire } from "../../features/daily";
import { csv, readSheet } from "../../features/spreadsheet";
import { adminGuard } from "./guard";
import { authorize } from "../../permissions";
const reason = t.String({ minLength: 3, maxLength: 500 });
const question = t.Object({
  id: t.String({ minLength: 1, maxLength: 80 }),
  type: t.Union([
    t.Literal("single"),
    t.Literal("multiple"),
    t.Literal("short"),
  ]),
  subject: t.Union([
    t.Literal("math"),
    t.Literal("science"),
    t.Literal("general_aptitude"),
    t.Literal("thai"),
    t.Literal("english"),
  ]),
  topic: t.String({ maxLength: 150 }),
  prompt: t.String({ maxLength: 10000 }),
  choices: t.Array(
    t.Object({
      key: t.String({ minLength: 1, maxLength: 8 }),
      text: t.String({ maxLength: 2000 }),
    }),
    { maxItems: 20 },
  ),
  correctChoices: t.Array(t.String({ maxLength: 8 }), { maxItems: 20 }),
  acceptedAnswers: t.Array(t.String({ maxLength: 500 }), { maxItems: 50 }),
  hint: t.String({ maxLength: 2000 }),
  showHint: t.Boolean(),
  explanation: t.String({ maxLength: 10000 }),
  reveal: t.Union([t.Literal("finished"), t.Literal("next_day")]),
  imageUrls: t.Optional(t.Array(t.String({ maxLength: 2000 }), { maxItems: 10 })),
  linkUrls: t.Optional(t.Array(t.String({ maxLength: 2000 }), { maxItems: 10 })),
  sourceQuestionId: t.Optional(t.String({ format: "uuid" })),
});
/** Same figure rules as the exam bank: our own uploads or https only. */
const UPLOADED_IMAGE = /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/;
const HTTPS_URL = /^https:\/\/\S+$/i;
const editable = {
  title: t.String({ maxLength: 200 }),
  date: t.Nullable(t.String({ maxLength: 10 })),
  status: t.Union([t.Literal("draft"), t.Literal("scheduled")]),
  queueOrder: t.Integer({ minimum: 0, maximum: 100000 }),
  questions: t.Array(question, { minItems: 1, maxItems: 30 }),
};
const params = t.Object({ id: t.String({ format: "uuid" }) });
/**
 * Tidy what the editor sends (blank choice lines, lower-case keys, blank
 * topic) and reject anything a student could not answer, naming the item.
 */
function validate(body: { title: string; date: string | null; questions: DailyQuestion[] }) {
  if (!body.title.trim()) fail("ตั้งชื่อชุดโจทย์ก่อนบันทึก");
  if (body.date && !validDay(body.date)) fail("วันที่ไม่ถูกต้อง");
  if (new Set(body.questions.map((q) => q.id)).size !== body.questions.length)
    fail("มีโจทย์ซ้ำกันในชุดนี้");
  body.questions.forEach((q, i) => {
    const n = `ข้อ ${i + 1}`;
    q.topic = q.topic.trim() || "ทั่วไป";
    q.prompt = q.prompt.trim();
    if (!q.prompt) fail(`${n}: ยังไม่มีข้อความโจทย์`);
    q.choices = q.type === "short" ? [] : q.choices.filter((c) => c.text.trim());
    q.correctChoices = q.correctChoices.map((k) => k.trim().toUpperCase()).filter(Boolean);
    q.acceptedAnswers = q.acceptedAnswers.map((a) => a.trim()).filter(Boolean);
    q.imageUrls = (q.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
    q.linkUrls = (q.linkUrls ?? []).map((u) => u.trim()).filter(Boolean);
    if (q.imageUrls.some((u) => !UPLOADED_IMAGE.test(u) && !HTTPS_URL.test(u)))
      fail(`${n}: รูปต้องเป็นไฟล์ที่อัปโหลดในระบบหรือลิงก์ https`);
    if (q.linkUrls.some((u) => !HTTPS_URL.test(u))) fail(`${n}: ลิงก์ต้องขึ้นต้นด้วย https://`);
    const keys = q.choices.map((c) => c.key);
    if (new Set(keys).size !== keys.length) fail(`${n}: ตัวเลือกซ้ำ`);
    if (q.type === "short") {
      if (!q.acceptedAnswers.length) fail(`${n}: ใส่คำตอบที่รับอย่างน้อย 1 คำตอบ`);
      return;
    }
    if (q.choices.length < 2) fail(`${n}: ต้องมีตัวเลือกอย่างน้อย 2 ตัว`);
    if (!q.correctChoices.length) fail(`${n}: ยังไม่ได้ใส่เฉลย`);
    const missing = q.correctChoices.find((k) => !keys.includes(k));
    if (missing) fail(`${n}: เฉลย ${missing} ไม่มีในตัวเลือก (มี ${keys.join(", ")})`);
    if (q.type === "single" && q.correctChoices.length !== 1) fail(`${n}: ข้อเลือกข้อเดียวต้องมีเฉลย 1 ตัว`);
  });
}
export const adminDailyRoutes = new Elysia({ prefix: "/admin/daily" })
  .use(adminGuard)
  /**
   * The exam question bank, for building a daily set from questions written
   * there first. Requires exam read rights on top of daily, because it
   * returns answer keys.
   */
  .get(
    "/bank",
    async ({ query, headers }) => {
      // The bank holds mock-exam answer keys: daily rights alone are not enough to read it.
      await authorize(headers, "exam", "read");
      const conds = [eq(questions.active, true)];
      if (query.subject) conds.push(eq(questions.subject, query.subject));
      if (query.q) {
        const needle = `%${query.q}%`;
        conds.push(or(ilike(questions.prompt, needle), ilike(questions.topic, needle))!);
      }
      const where = and(...conds);
      const limit = query.limit ?? 30;
      const offset = query.offset ?? 0;
      const [rows, [totals]] = await Promise.all([
        db
          .select({
            id: questions.id,
            subject: questions.subject,
            topic: questions.topic,
            prompt: questions.prompt,
            imageUrls: questions.imageUrls,
            linkUrls: questions.linkUrls,
            type: questions.type,
            choices: questions.choices,
            correctChoices: questions.correctChoices,
            acceptedAnswers: questions.acceptedAnswers,
            explanation: questions.explanation,
            // Published mock exams holding this question: using it daily would reveal its key.
            inPublishedPacks: sql<number>`(select count(*) from pack_questions pq join exam_packs ep on ep.id = pq.pack_id where pq.question_id = questions.id and ep.published)`,
            usedInDaily: sql<number>`(select count(*) from daily_challenges d, jsonb_array_elements(d.questions) e where e->>'sourceQuestionId' = questions.id::text)`,
          })
          .from(questions)
          .where(where)
          .orderBy(desc(questions.updatedAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(questions).where(where),
      ]);
      return {
        questions: rows.map((r) => ({ ...r, inPublishedPacks: Number(r.inPublishedPacks), usedInDaily: Number(r.usedInDaily) })),
        total: Number(totals?.total ?? 0),
        topics: (await db.selectDistinct({ topic: questions.topic }).from(questions).orderBy(questions.topic).limit(500)).map((r) => r.topic),
      };
    },
    {
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 200 })),
        subject: t.Optional(t.Union(["math", "science", "general_aptitude", "thai", "english"].map((v) => t.Literal(v)) as [ReturnType<typeof t.Literal<"math">>])),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Integer({ minimum: 0 })),
      }),
    },
  )
  /**
   * Write a new question from the daily editor. It is saved into the shared
   * exam bank (same form and rules as คลังข้อสอบ) and the editor then adds a
   * copy to the daily set, so every daily question also lives in the bank.
   */
  .post(
    "/bank",
    async ({ body, headers, set }) => {
      // Writing into the shared exam bank needs exam rights, same as คลังข้อสอบ.
      await authorize(headers, "exam", "write");
      const checked = normalise(body);
      if ("error" in checked) {
        set.status = 422;
        return { error: checked.error };
      }
      const [question] = await db.insert(questions).values(checked.values).returning(adminColumns);
      await audit(await actorOf(headers), { action: "question.create_from_daily", module: "daily", targetId: question!.id, after: question });
      set.status = 201;
      return { question: { ...question!, inPublishedPacks: 0, usedInDaily: 0 } };
    },
    { body: questionBody },
  )
  .get("/", async () => ({
    challenges: await db
      .select()
      .from(dailyChallenges)
      .orderBy(desc(dailyChallenges.createdAt))
      .limit(500),
    days: await db
      .select()
      .from(dailyAssignments)
      .orderBy(desc(dailyAssignments.date))
      .limit(31),
  }))
  .post(
    "/",
    async ({ body, headers, set }) => {
      validate(body);
      return db.transaction(async (tx) => {
        const [row] = await tx.insert(dailyChallenges).values(body).returning();
        await tx.insert(dailyRevisions).values({
          challengeId: row!.id,
          version: 1,
          snapshot: row,
          actorId: (await actorOf(headers)).id,
          reason: "สร้างโจทย์",
        });
        await auditTx(tx, await actorOf(headers), {
          module: "daily",
          action: "daily.create",
          targetId: row!.id,
          after: row,
        });
        set.status = 201;
        return { challenge: row };
      });
    },
    { body: t.Object(editable) },
  )
  .get(
    "/analytics",
    async ({ query }) => {
      const where = query.date
        ? eq(dailyResponses.date, query.date)
        : undefined;
      // Aggregates over every stored response, not just the newest 1000 rows
      // listed below. A user counts as correct once any try was right.
      const perQuestion = await db
        .select({
          date: dailyResponses.date,
          questionId: dailyResponses.questionId,
          users: sql<number>`count(distinct ${dailyResponses.userId})::int`,
          correctUsers: sql<number>`(count(distinct ${dailyResponses.userId}) filter (where ${dailyResponses.correct}))::int`,
          firstTryCorrect: sql<number>`(count(*) filter (where ${dailyResponses.tryNo} = 1 and ${dailyResponses.correct}))::int`,
          hints: sql<number>`(count(*) filter (where ${dailyResponses.hintShown}))::int`,
        })
        .from(dailyResponses)
        .where(where)
        .groupBy(dailyResponses.date, dailyResponses.questionId)
        .orderBy(desc(dailyResponses.date))
        .limit(2000);
      const perDay = await db
        .select({
          date: dailyResponses.date,
          participants: sql<number>`count(distinct ${dailyResponses.userId})::int`,
        })
        .from(dailyResponses)
        .where(where)
        .groupBy(dailyResponses.date)
        .orderBy(desc(dailyResponses.date))
        .limit(366);
      const increased = await db
        .select({ date: fireLedger.date, n: sql<number>`count(*)::int` })
        .from(fireLedger)
        .where(
          and(
            eq(fireLedger.state, "increased"),
            query.date ? eq(fireLedger.date, query.date) : undefined,
          ),
        )
        .groupBy(fireLedger.date);
      const dates = [...new Set(perQuestion.map((r) => r.date))];
      const snapshots = dates.length
        ? await db
            .select({
              date: dailyAssignments.date,
              questions: dailyAssignments.questions,
            })
            .from(dailyAssignments)
            .where(inArray(dailyAssignments.date, dates))
        : [];
      const pct = (part: number, whole: number) =>
        whole ? Math.round((1000 * part) / whole) / 10 : null;
      const byQuestion = perQuestion.map((r) => {
        const q = snapshots
          .find((d) => d.date === r.date)
          ?.questions.find((q) => q.id === r.questionId);
        return {
          ...r,
          subject: q?.subject ?? null,
          topic: q?.topic ?? null,
          prompt: q?.prompt.slice(0, 120) ?? null,
          successPct: pct(r.correctUsers, r.users),
        };
      });
      const topics = new Map<
        string,
        { subject: string; topic: string; users: number; wrongUsers: number }
      >();
      for (const r of byQuestion) {
        if (!r.subject) continue;
        const key = `${r.subject}|${r.topic}`;
        const t = topics.get(key) ?? {
          subject: r.subject,
          topic: r.topic ?? "",
          users: 0,
          wrongUsers: 0,
        };
        t.users += r.users;
        t.wrongUsers += r.users - r.correctUsers;
        topics.set(key, t);
      }
      return {
        byDay: perDay.map((d) => {
          const n = increased.find((i) => i.date === d.date)?.n ?? 0;
          return { ...d, increased: n, successPct: pct(n, d.participants) };
        }),
        byQuestion,
        weakTopics: [...topics.values()]
          .map((t) => ({ ...t, wrongPct: pct(t.wrongUsers, t.users) }))
          .sort(
            (a, b) => (b.wrongPct ?? 0) - (a.wrongPct ?? 0) || b.users - a.users,
          )
          .slice(0, 20),
        responses: await db
          .select()
          .from(dailyResponses)
          .where(where)
          .orderBy(desc(dailyResponses.createdAt))
          .limit(1000),
        ledger: await db
          .select()
          .from(fireLedger)
          .where(query.date ? eq(fireLedger.date, query.date) : undefined)
          .orderBy(desc(fireLedger.createdAt))
          .limit(1000),
        recoveries: await db
          .select()
          .from(fireRecovery)
          .orderBy(desc(fireRecovery.createdAt))
          .limit(500),
        summaries: await db.select().from(fireSummary).limit(500),
      };
    },
    { query: t.Object({ date: t.Optional(t.String({ maxLength: 10 })) }) },
  )
  .get("/template", ({ set }) => {
    set.headers["content-type"] = "text/csv; charset=utf-8";
    set.headers["content-disposition"] =
      'attachment; filename="daily-template.csv"';
    return csv([
      [
        "daily_date",
        "title",
        "question_key",
        "type",
        "stem",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "answer",
        "subject",
        "topic",
        "hint",
        "answer_release",
        "priority",
      ],
      [
        "",
        "โจทย์สำรอง",
        "Q001",
        "single",
        "2+3 เท่ากับเท่าไร",
        "4",
        "5",
        "6",
        "7",
        "B",
        "math",
        "จำนวนเต็ม",
        "ลองนับต่อจาก 2",
        "next_day",
        "0",
      ],
    ]);
  })
  .post(
    "/import",
    async ({ body, headers }) => {
      const rows = await readSheet(body.file, [
        "daily_date",
        "title",
        "question_key",
        "type",
        "stem",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "answer",
        "subject",
        "topic",
        "hint",
        "answer_release",
        "priority",
      ]);
      const grouped = new Map<
        string,
        {
          title: string;
          date: string | null;
          status: "scheduled";
          queueOrder: number;
          questions: DailyQuestion[];
        }
      >();
      for (const [i, r] of rows.entries()) {
        if (
          !["single", "multiple", "short"].includes(r.type ?? "") ||
          !["math", "science", "general_aptitude", "thai", "english"].includes(
            r.subject ?? "",
          ) ||
          !r.stem ||
          !r.answer ||
          !r.question_key ||
          !r.title ||
          !r.topic
        )
          fail(`แถว ${i + 2}: ข้อมูลบังคับไม่ครบ`);
        const key = r.daily_date || r.title!;
        const g = grouped.get(key) ?? {
          title: r.title!,
          date: r.daily_date || null,
          status: "scheduled",
          queueOrder: Number(r.priority || 0),
          questions: [],
        };
        if (!Number.isInteger(g.queueOrder) || g.queueOrder < 0)
          fail(`แถว ${i + 2}: priority ไม่ถูกต้อง`);
        g.questions.push({
          id: r.question_key!,
          type: r.type as DailyQuestion["type"],
          subject: r.subject as DailyQuestion["subject"],
          prompt: r.stem!,
          topic: r.topic!,
          choices: ["a", "b", "c", "d"]
            .filter((k) => r[`option_${k}`])
            .map((k) => ({ key: k.toUpperCase(), text: r[`option_${k}`]! })),
          correctChoices:
            r.type === "short" ? [] : r.answer!.split("|").map((s) => s.trim()),
          acceptedAnswers: r.type === "short" ? r.answer!.split("|") : [],
          hint: r.hint ?? "",
          showHint: !!r.hint,
          explanation: "",
          reveal: r.answer_release === "finished" ? "finished" : "next_day",
        });
        validate(g);
        grouped.set(key, g);
      }
      const challenges = [...grouped.values()];
      const base = hash(await db.select().from(dailyChallenges));
      for (const g of challenges)
        if (g.date) {
          const [used] = await db
            .select()
            .from(dailyChallenges)
            .where(eq(dailyChallenges.date, g.date));
          if (used) fail(`วันที่ ${g.date} มีโจทย์แล้ว`);
        }
      return {
        ...(await preview("daily_import", "all", await actorOf(headers), base, {
          challenges,
          reason: body.reason,
        })),
        challenges,
        count: challenges.length,
      };
    },
    { body: t.Object({ file: t.File({ maxSize: 3 * 1024 * 1024 }), reason }) },
  )
  .post(
    "/import/commit",
    async ({ body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, "daily:admin");
        const actor = await actorOf(headers);
        const payload = (await consumePreview(
          tx,
          body.previewId,
          "daily_import",
          "all",
          actor,
          hash(await tx.select().from(dailyChallenges)),
        )) as {
          challenges: (typeof dailyChallenges.$inferInsert)[];
          reason: string;
        };
        for (const c of payload.challenges) {
          const [row] = await tx.insert(dailyChallenges).values(c).returning();
          await tx.insert(dailyRevisions).values({
            challengeId: row!.id,
            version: 1,
            snapshot: row,
            actorId: actor.id,
            reason: payload.reason,
          });
        }
        await auditTx(tx, actor, {
          action: "daily.import",
          module: "daily",
          after: { count: payload.challenges.length },
          reason: payload.reason,
          sourceId: body.previewId,
        });
        return { created: payload.challenges.length };
      }),
    { body: t.Object({ previewId: t.String({ format: "uuid" }) }) },
  )
  .post(
    "/outage/preview",
    async ({ body, headers }) => {
      if (
        !validDay(body.from) ||
        !validDay(body.to) ||
        body.to < body.from ||
        body.to > bangkokDay() ||
        body.from < addDays(body.to, -31)
      )
        fail("ช่วงวันต้องอยู่ภายใน 31 วันและไม่เป็นอนาคต");
      let until: string | null = null;
      if (body.mode === "extend") {
        // Only today's challenge can be extended: after midnight its key is
        // revealed and copied to the archive, so a later extension is unfair.
        const today = bangkokDay(),
          close = endOfDay(today).getTime(),
          at = Date.parse(body.until ?? "");
        if (body.from !== today || body.to !== today)
          fail("ขยายเวลาได้เฉพาะโจทย์ของวันนี้ก่อนปิดรับ 23:59:59 น. หากเลยเที่ยงคืนแล้วให้ใช้การรักษาหรือชดเชย");
        if (!Number.isFinite(at) || at <= close || at > close + 86400000)
          fail("เวลาสิ้นสุดต้องอยู่หลังเวลาปิดรับปกติและไม่เกิน 24 ชั่วโมง");
        until = new Date(at).toISOString();
      }
      const everyone = body.mode === "extend" && !body.userIds.length;
      const users = body.userIds.length
        ? body.userIds
        : everyone
          ? []
          : (await db.select().from(fireSummary)).map((s) => s.userId);
      const summaries = await db.select().from(fireSummary);
      return {
        ...(await preview(
          "daily_outage",
          "all",
          await actorOf(headers),
          hash(summaries),
          { ...body, userIds: users, until, everyone },
        )),
        affected: everyone ? summaries.length : users.length,
        everyone,
        until,
        days:
          body.from === body.to
            ? 1
            : Math.round(
                (Date.parse(body.to) - Date.parse(body.from)) / 86400000,
              ) + 1,
      };
    },
    {
      body: t.Object({
        from: t.String({ maxLength: 10 }),
        to: t.String({ maxLength: 10 }),
        userIds: t.Array(t.String({ format: "uuid" }), { maxItems: 10000 }),
        mode: t.Union([
          t.Literal("protect"),
          t.Literal("compensate"),
          t.Literal("bulk_recover"),
          t.Literal("extend"),
        ]),
        until: t.Optional(t.String({ maxLength: 40 })),
        reason,
      }),
    },
  )
  .post(
    "/outage/commit",
    async ({ body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, "daily:admin");
        const actor = await actorOf(headers);
        const p = (await consumePreview(
          tx,
          body.previewId,
          "daily_outage",
          "all",
          actor,
          hash(await tx.select().from(fireSummary)),
        )) as {
          from: string;
          to: string;
          userIds: string[];
          mode: string;
          reason: string;
          until?: string | null;
          everyone?: boolean;
        };
        if (p.mode === "extend") {
          // Recheck at commit: the preview may have been approved after midnight.
          if (p.from !== bangkokDay() || Date.parse(p.until!) <= Date.now())
            fail("พ้นเวลาที่ขยายได้แล้ว กรุณาเลือกวิธีรักษาหรือชดเชยแทน", 409);
          await tx.insert(dailyExtensions).values({
            date: p.from,
            until: new Date(p.until!),
            userIds: p.everyone ? null : [...p.userIds].sort(),
            source: body.previewId,
            reason: p.reason,
          });
          await auditTx(tx, actor, {
            action: "daily.extend",
            module: "daily",
            after: p,
            reason: p.reason,
            sourceId: body.previewId,
          });
          return { affected: p.everyone ? null : p.userIds.length, until: p.until };
        }
        for (const userId of [...p.userIds].sort()) {
          await lock(tx, `fire:${userId}`);
          let [s] = await tx
            .select()
            .from(fireSummary)
            .where(eq(fireSummary.userId, userId))
            .for("update");
          if (!s) {
            [s] = await tx
              .insert(fireSummary)
              .values({ userId, lastDate: bangkokDay() })
              .returning();
          }
          for (let date = p.from; date <= p.to; date = addDays(date, 1)) {
            const [event] = await tx
              .select()
              .from(fireLedger)
              .where(
                and(eq(fireLedger.userId, userId), eq(fireLedger.date, date)),
              );
            if (event?.increment === 1) continue;
            // Restore a broken streak only when no later, uncompensated missed day
            // remains outside this approved outage. Replaying cannot restore twice.
            if (event?.state === "lost" && event.previousCurrent) {
              const laterMisses = await tx
                .select()
                .from(fireLedger)
                .where(
                  and(
                    eq(fireLedger.userId, userId),
                    gt(fireLedger.date, date),
                    inArray(fireLedger.state, ["lost", "pending"]),
                  ),
                );
              if (!laterMisses.some((e) => e.date > p.to))
                s!.current += event.previousCurrent;
            }
            const delta = p.mode === "compensate" ? 1 : 0;
            await tx
              .insert(fireLedger)
              .values({
                userId,
                date,
                state: delta ? "increased" : "admin_protected",
                increment: delta,
                source: body.previewId,
              })
              .onConflictDoUpdate({
                target: [fireLedger.userId, fireLedger.date],
                set: {
                  state: delta ? "increased" : "admin_protected",
                  increment: delta,
                  source: body.previewId,
                },
              });
            s!.current += delta;
            s!.highest = Math.max(s!.highest, s!.current);
          }
          await tx
            .update(fireSummary)
            .set({
              current: s!.current,
              highest: s!.highest,
              pendingDate:
                s!.pendingDate &&
                s!.pendingDate >= p.from &&
                s!.pendingDate <= p.to
                  ? null
                  : s!.pendingDate,
              version: s!.version + 1,
            })
            .where(eq(fireSummary.userId, userId));
        }
        await auditTx(tx, actor, {
          action: "daily.outage",
          module: "daily",
          after: p,
          reason: p.reason,
          sourceId: body.previewId,
        });
        return { affected: p.userIds.length };
      }),
    { body: t.Object({ previewId: t.String({ format: "uuid" }) }) },
  )
  .post(
    "/:id/preview",
    async ({ params, body, headers }) => {
      validate(body);
      const [c] = await db
        .select()
        .from(dailyChallenges)
        .where(eq(dailyChallenges.id, params.id));
      if (!c) fail("ไม่พบโจทย์", 404);
      const assignments = await db
        .select()
        .from(dailyAssignments)
        .where(eq(dailyAssignments.challengeId, params.id));
      const responses = assignments.length
        ? await db
            .select()
            .from(dailyResponses)
            .where(
              inArray(
                dailyResponses.date,
                assignments.map((d) => d.date),
              ),
            )
        : [];
      return {
        ...(await preview(
          "daily_edit",
          params.id,
          await actorOf(headers),
          String(c!.revision),
          body,
        )),
        affectedUsers: new Set(responses.map((r) => r.userId)).size,
        affectedResponses: responses.length,
        before: c,
        after: body,
      };
    },
    {
      params,
      body: t.Object({
        ...editable,
        reason,
        keepFire: t.Boolean(),
        resetTries: t.Boolean(),
      }),
    },
  )
  .post(
    "/:id/commit",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, "daily:admin");
        const actor = await actorOf(headers);
        const [c] = await tx
          .select()
          .from(dailyChallenges)
          .where(eq(dailyChallenges.id, params.id))
          .for("update");
        if (!c) fail("ไม่พบโจทย์", 404);
        const p = (await consumePreview(
          tx,
          body.previewId,
          "daily_edit",
          params.id,
          actor,
          String(c!.revision),
        )) as {
          title: string;
          date: string | null;
          status: string;
          queueOrder: number;
          questions: DailyQuestion[];
          reason: string;
          keepFire: boolean;
          resetTries: boolean;
        };
        const assigned = await tx
          .select()
          .from(dailyAssignments)
          .where(eq(dailyAssignments.challengeId, params.id));
        if (assigned.length && c!.date !== p.date)
          fail("ย้ายวันที่ของโจทย์ที่มี snapshot แล้วไม่ได้", 409);
        const nextQuestions = p.resetTries
          ? p.questions.map((q) => ({ ...q, id: randomUUID() }))
          : p.questions;
        await tx.insert(dailyRevisions).values({
          challengeId: params.id,
          version: c!.revision,
          snapshot: c,
          actorId: actor.id,
          reason: p.reason,
        });
        await tx
          .update(dailyChallenges)
          .set({
            title: p.title,
            date: p.date,
            status: p.status,
            queueOrder: p.queueOrder,
            questions: nextQuestions,
            revision: c!.revision + 1,
          })
          .where(eq(dailyChallenges.id, params.id));
        for (const day of assigned) {
          await lock(tx, `daily:${day.date}`);
          const responses = await tx
            .select()
            .from(dailyResponses)
            .where(eq(dailyResponses.date, day.date));
          for (const r of responses) {
            const q = p.questions.find((q) => q.id === r.questionId);
            if (!q) continue;
            await tx
              .update(dailyResponses)
              .set({
                correct: correctAnswer(q, r.answer),
                verdictHistory: [
                  ...r.verdictHistory,
                  {
                    correct: r.correct,
                    at: new Date().toISOString(),
                    reason: p.reason,
                  },
                ],
              })
              .where(eq(dailyResponses.id, r.id));
          }
          await tx
            .update(dailyAssignments)
            .set({
              questions: nextQuestions,
              revision: c!.revision + 1,
              title: p.title,
            })
            .where(eq(dailyAssignments.date, day.date));
          if (!p.keepFire) {
            const updated = await tx
              .select()
              .from(dailyResponses)
              .where(eq(dailyResponses.date, day.date));
            for (const userId of [
              ...new Set(updated.map((r) => r.userId)),
            ].sort()) {
              const s = await settleFire(tx, userId);
              const [event] = await tx
                .select()
                .from(fireLedger)
                .where(
                  and(
                    eq(fireLedger.userId, userId),
                    eq(fireLedger.date, day.date),
                  ),
                );
              if (
                event?.increment === 1 ||
                !p.questions.every((q) =>
                  updated.some(
                    (r) =>
                      r.userId === userId && r.questionId === q.id && r.correct,
                  ),
                )
              )
                continue;
              await tx
                .insert(fireLedger)
                .values({
                  userId,
                  date: day.date,
                  state: "increased",
                  increment: 1,
                  source: body.previewId,
                })
                .onConflictDoUpdate({
                  target: [fireLedger.userId, fireLedger.date],
                  set: {
                    state: "increased",
                    increment: 1,
                    source: body.previewId,
                  },
                });
              await tx
                .update(fireSummary)
                .set({
                  current: s.current + 1,
                  highest: Math.max(s.highest, s.current + 1),
                  version: s.version + 1,
                })
                .where(eq(fireSummary.userId, userId));
            }
          }
        }
        await auditTx(tx, actor, {
          action: "daily.regrade",
          module: "daily",
          targetId: params.id,
          before: c,
          after: p,
          reason: p.reason,
          sourceId: body.previewId,
        });
        return { ok: true };
      }),
    { params, body: t.Object({ previewId: t.String({ format: "uuid" }) }) },
  );
