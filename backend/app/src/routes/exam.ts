import { Elysia, t } from "elysia";
import { and, asc, count, desc, eq, inArray, lte, sql } from "drizzle-orm";

import { currentUser } from "../auth";
import { db } from "../db";
import { attemptAnswers, attempts, examPacks, packQuestions, questions, type UserRole } from "../db/schema";
import { countsTowardLimit, gradeAttempt, settleIfExpired } from "../grading";
import { profileComplete } from "../sessions";

/**
 * Mock exams are free: any signed-in student with a complete profile may
 * start a published pack inside its window, up to its attempt limit.
 * pack_products / entitlements no longer gate exams.
 */

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
};

type PackRow = { opensAt: Date | null; closesAt: Date | null; published: boolean };
export type PackAvailability = "upcoming" | "open" | "closed";

export function availability(pack: PackRow, now = new Date()): PackAvailability {
  if (pack.opensAt && now < pack.opensAt) return "upcoming";
  if (pack.closesAt && now >= pack.closesAt) return "closed";
  return "open";
}

/** Staff and QA accounts may open hidden packs, ignore the window and the attempt limit, to test. */
function isStaff(user: { role: UserRole } | null) {
  return user !== null && (user.role === "admin" || user.role === "dev" || user.role === "test");
}

/** Seconds a student gets on this pack; the hard deadline may cut an attempt shorter. */
function packTiming(pack: { durationSeconds: number }) {
  return { durationSeconds: pack.durationSeconds, allowedSeconds: pack.durationSeconds };
}

/** Per-user attempt counts on these packs: used (not reset) and the open attempt, if any. */
async function myAttemptState(userId: string, packIds: string[]) {
  const map = new Map<string, { used: number; openAttemptId: string | null }>();
  if (packIds.length === 0) return map;
  const rows = await db
    .select({ id: attempts.id, packId: attempts.packId, status: attempts.status, resetAt: attempts.resetAt })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), inArray(attempts.packId, packIds)));
  for (const r of rows) {
    const s = map.get(r.packId) ?? { used: 0, openAttemptId: null };
    if (!r.resetAt) s.used += 1;
    if (r.status === "in_progress") s.openAttemptId = r.id;
    map.set(r.packId, s);
  }
  return map;
}

/** What the instructions screen shows: sections, points, question types. No key. */
async function packSummary(packId: string) {
  const rows = await db
    .select({ section: packQuestions.section, type: questions.type, points: questions.points })
    .from(packQuestions)
    .innerJoin(questions, eq(questions.id, packQuestions.questionId))
    .where(eq(packQuestions.packId, packId))
    .orderBy(asc(packQuestions.position));
  const sections: { title: string; questions: number; points: number }[] = [];
  const types = { single: 0, multiple: 0, short: 0 };
  let totalPoints = 0;
  for (const r of rows) {
    types[r.type] += 1;
    totalPoints += r.points;
    const title = r.section ?? "";
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.questions += 1;
      last.points += r.points;
    } else sections.push({ title, questions: 1, points: r.points });
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    questions: rows.length,
    totalPoints: round(totalPoints),
    // A pack with no section labels is one unnamed part.
    sections: sections.map((s) => ({ ...s, points: round(s.points) })),
    types,
  };
}

const attemptColumns = {
  id: attempts.id,
  packId: attempts.packId,
  status: attempts.status,
  startedAt: attempts.startedAt,
  expiresAt: attempts.expiresAt,
  submittedAt: attempts.submittedAt,
  score: attempts.score,
  maxScore: attempts.maxScore,
  topicBreakdown: attempts.topicBreakdown,
  attemptNo: attempts.attemptNo,
  resetAt: attempts.resetAt,
};

export const examPacksRoutes = new Elysia({ prefix: "/exam-packs" })
  /**
   * Published packs (every pack for staff) with their window state and, for
   * a signed-in user, how many attempts they have used.
   */
  .get("/", async ({ headers }) => {
    const user = await currentUser(headers);
    const staff = isStaff(user);
    const rows = await db
      .select(packColumns)
      .from(examPacks)
      .where(staff ? undefined : eq(examPacks.published, true))
      .orderBy(examPacks.title);
    const mine = user ? await myAttemptState(user.id, rows.map((r) => r.id)) : new Map();
    const now = new Date();
    return {
      packs: rows.map((pack) => {
        const s = mine.get(pack.id) ?? { used: 0, openAttemptId: null };
        return {
          ...pack,
          availability: availability(pack, now),
          attemptsUsed: s.used,
          openAttemptId: s.openAttemptId,
          ...packTiming(pack),
        };
      }),
      serverNow: now.toISOString(),
    };
  })
  .get(
    "/:slug",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      const [pack] = await db.select(packColumns).from(examPacks).where(eq(examPacks.slug, params.slug)).limit(1);
      if (!pack || (!pack.published && !isStaff(user))) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      const timing = packTiming(pack);
      const [summary, mine] = await Promise.all([
        packSummary(pack.id),
        user ? myAttemptState(user.id, [pack.id]) : Promise.resolve(new Map()),
      ]);
      const s = mine.get(pack.id) ?? { used: 0, openAttemptId: null };
      const now = new Date();
      return {
        pack: {
          ...pack,
          ...timing,
          availability: availability(pack, now),
          attemptsUsed: s.used,
          openAttemptId: s.openAttemptId,
          summary,
        },
        serverNow: now.toISOString(),
      };
    },
    { params: t.Object({ slug: t.String({ minLength: 1, maxLength: 80 }) }) }
  );

/**
 * The session user's attempt, settled against the server clock first, so a
 * past-deadline attempt is already graded as expired when a route sees it.
 * Null when the id is not theirs.
 */
async function ownedAttempt(userId: string, attemptId: string) {
  const load = () =>
    db
      .select(attemptColumns)
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
      .limit(1);
  let [row] = await load();
  if (!row) return null;
  if (await settleIfExpired(row)) [row] = await load();
  return row ?? null;
}

type AttemptRow = NonNullable<Awaited<ReturnType<typeof ownedAttempt>>>;

/** Attempt as the client sees it, with the time left by the server clock. */
function attemptView(attempt: AttemptRow) {
  const now = new Date();
  return {
    ...attempt,
    allowedSeconds: Math.round((attempt.expiresAt.getTime() - attempt.startedAt.getTime()) / 1000),
    secondsLeft:
      attempt.status === "in_progress"
        ? Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000))
        : 0,
    serverNow: now.toISOString(),
  };
}

/**
 * Question columns a student may see. Never widen this to the whole row:
 * correctChoices, acceptedAnswers and explanation stay on the server.
 */
const studentQuestionColumns = {
  id: questions.id,
  position: packQuestions.position,
  section: packQuestions.section,
  subject: questions.subject,
  topic: questions.topic,
  type: questions.type,
  points: questions.points,
  prompt: questions.prompt,
  imageUrls: questions.imageUrls,
  linkUrls: questions.linkUrls,
  choices: questions.choices,
};

const CLOSED_ERROR = "หมดเวลาหรือส่งคำตอบชุดนี้แล้ว";
const MAX_TEXT_ANSWER = 500;

export const attemptsRoutes = new Elysia({ prefix: "/attempts" })
  /** The caller's attempt history, newest first, reset attempts included and marked. */
  .get("/", async ({ headers, set }) => {
    const user = await currentUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบ" };
    }
    // Settle anything past its deadline so history never shows a stale clock.
    const stale = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.userId, user.id), eq(attempts.status, "in_progress"), lte(attempts.expiresAt, new Date())));
    for (const s of stale) await gradeAttempt(s.id, "expired");

    const rows = await db
      .select({ ...attemptColumns, title: examPacks.title, slug: examPacks.slug, showReview: examPacks.showReview })
      .from(attempts)
      .innerJoin(examPacks, eq(examPacks.id, attempts.packId))
      .where(eq(attempts.userId, user.id))
      .orderBy(desc(attempts.startedAt))
      .limit(200);
    return { attempts: rows };
  })
  /**
   * Start an attempt — the student pressed "เริ่มทำข้อสอบ" on the
   * instructions screen, so the clock starts now. The deadline is the pack
   * time, capped at the pack's hard deadline; the client never
   * supplies time.
   */
  .post(
    "/",
    async ({ body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบก่อนทำข้อสอบ" };
      }
      if (!profileComplete(user)) {
        set.status = 409;
        return { error: "กรอกข้อมูลส่วนตัวให้ครบก่อนเริ่มทำข้อสอบ", code: "profile_required" };
      }

      const [pack] = await db.select(packColumns).from(examPacks).where(eq(examPacks.id, body.packId)).limit(1);
      const staff = isStaff(user);
      if (!pack || (!pack.published && !staff)) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }

      const [{ n }] = await db.select({ n: count() }).from(packQuestions).where(eq(packQuestions.packId, pack.id));
      if (n === 0) {
        set.status = 409;
        return { error: "ชุดนี้ยังไม่มีข้อสอบ" };
      }

      // Grade anything left open past its deadline before looking for one
      // to resume, so a stale attempt never lingers as in_progress.
      const stale = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(
          and(
            eq(attempts.userId, user.id),
            eq(attempts.packId, pack.id),
            eq(attempts.status, "in_progress"),
            lte(attempts.expiresAt, new Date())
          )
        );
      for (const s of stale) await gradeAttempt(s.id, "expired");

      // Resume an open attempt instead of stacking a second clock. Allowed
      // even after the window closes: its expiresAt is already capped.
      const findOpen = () =>
        db
          .select(attemptColumns)
          .from(attempts)
          .where(and(eq(attempts.userId, user.id), eq(attempts.packId, pack.id), eq(attempts.status, "in_progress")))
          .limit(1);
      const [open] = await findOpen();
      const timing = packTiming(pack);
      if (open) return { attempt: { ...timing, ...attemptView(open) }, resumed: true };

      const state = availability(pack);
      if (state !== "open" && !staff) {
        set.status = 403;
        return { error: state === "upcoming" ? "ชุดนี้ยังไม่เปิดให้ทำ" : "ชุดนี้ปิดรับคำตอบแล้ว" };
      }

      const [{ used }] = await db.select({ used: count() }).from(attempts).where(countsTowardLimit(user.id, pack.id));
      if (pack.maxAttempts !== null && used >= pack.maxAttempts && !staff) {
        set.status = 403;
        return {
          error: pack.maxAttempts === 1 ? "ทำชุดนี้ไปแล้ว ชุดนี้ทำได้ 1 ครั้ง" : `ทำชุดนี้ครบ ${pack.maxAttempts} ครั้งแล้ว`,
          code: "attempt_limit",
        };
      }

      const [{ total }] = await db
        .select({ total: count() })
        .from(attempts)
        .where(and(eq(attempts.userId, user.id), eq(attempts.packId, pack.id)));

      // attempts_open_user_pack_key allows one open attempt per user and
      // pack; a concurrent start loses the insert and resumes the winner.
      const startedAt = new Date();
      const byDuration = startedAt.getTime() + timing.allowedSeconds * 1000;
      const expiresAt = new Date(pack.closesAt ? Math.min(byDuration, pack.closesAt.getTime()) : byDuration);
      const [attempt] = await db
        .insert(attempts)
        .values({
          userId: user.id,
          packId: pack.id,
          startedAt,
          expiresAt,
          attemptNo: total + 1,
          studentFirstName: user.firstName,
          studentLastName: user.lastName,
          studentNickname: user.nickname,
          studentCampus: user.campus,
          studentEmail: user.email,
        })
        .onConflictDoNothing({
          target: [attempts.userId, attempts.packId],
          where: sql`${attempts.status} = 'in_progress'`,
        })
        .returning(attemptColumns);
      if (!attempt) {
        const [winner] = await findOpen();
        return { attempt: { ...timing, ...attemptView(winner) }, resumed: true };
      }

      set.status = 201;
      return { attempt: { ...timing, ...attemptView(attempt) }, resumed: false };
    },
    { body: t.Object({ packId: t.String({ format: "uuid" }) }) }
  )
  .get(
    "/:id",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      // Scoped to the session user so another user's id reads as not found.
      const attempt = await ownedAttempt(user.id, params.id);
      if (!attempt) {
        set.status = 404;
        return { error: "ไม่พบการทำข้อสอบ" };
      }
      const [pack] = await db
        .select({ title: examPacks.title, slug: examPacks.slug, durationSeconds: examPacks.durationSeconds, showReview: examPacks.showReview })
        .from(examPacks)
        .where(eq(examPacks.id, attempt.packId))
        .limit(1);
      return { attempt: { ...attemptView(attempt), ...pack, showReview: Boolean(pack?.showReview) || isStaff(user) } };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  )
  /**
   * The questions of an open attempt plus the answers and flags saved so
   * far, so a refresh restores the exact state. No key, no explanations.
   */
  .get(
    "/:id/questions",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const attempt = await ownedAttempt(user.id, params.id);
      if (!attempt) {
        set.status = 404;
        return { error: "ไม่พบการทำข้อสอบ" };
      }
      if (attempt.status !== "in_progress") {
        set.status = 409;
        return { error: CLOSED_ERROR, attempt: attemptView(attempt) };
      }

      const [rows, answers, [pack]] = await Promise.all([
        db
          .select(studentQuestionColumns)
          .from(packQuestions)
          .innerJoin(questions, eq(questions.id, packQuestions.questionId))
          .where(eq(packQuestions.packId, attempt.packId))
          .orderBy(asc(packQuestions.position)),
        db
          .select({
            questionId: attemptAnswers.questionId,
            selectedChoices: attemptAnswers.selectedChoices,
            textAnswer: attemptAnswers.textAnswer,
            state: attemptAnswers.state,
          })
          .from(attemptAnswers)
          .where(eq(attemptAnswers.attemptId, attempt.id)),
        // The paper link is only handed out once the clock is running.
        db.select({ paperUrl: examPacks.paperUrl }).from(examPacks).where(eq(examPacks.id, attempt.packId)).limit(1),
      ]);
      return { attempt: attemptView(attempt), questions: rows, answers, paperUrl: pack?.paperUrl ?? null };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  )
  /**
   * Autosave one question: its full state (choices or typed text, plus the
   * flag), so a resend or an out-of-order retry lands on the same row
   * idempotently. Refused once the attempt is closed or the server clock
   * has run out.
   */
  .put(
    "/:id/answers/:questionId",
    async ({ params, body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const attempt = await ownedAttempt(user.id, params.id);
      if (!attempt) {
        set.status = 404;
        return { error: "ไม่พบการทำข้อสอบ" };
      }
      if (attempt.status !== "in_progress") {
        set.status = 409;
        return { error: CLOSED_ERROR, attempt: attemptView(attempt) };
      }

      // The question must belong to this attempt's pack, and the answer must
      // fit its type: one key for single, distinct own keys for multiple,
      // text only for short.
      const [question] = await db
        .select({ type: questions.type, choices: questions.choices })
        .from(packQuestions)
        .innerJoin(questions, eq(questions.id, packQuestions.questionId))
        .where(and(eq(packQuestions.packId, attempt.packId), eq(packQuestions.questionId, params.questionId)))
        .limit(1);
      if (!question) {
        set.status = 404;
        return { error: "ไม่พบข้อนี้ในชุดข้อสอบ" };
      }
      const keys = (question.choices as { key: string }[]).map((c) => c.key);
      const picked = body.selectedChoices;
      const text = body.textAnswer ?? null;
      const invalid =
        question.type === "short"
          ? picked.length > 0
          : text !== null ||
            new Set(picked).size !== picked.length ||
            picked.some((k) => !keys.includes(k)) ||
            (question.type === "single" && picked.length > 1);
      if (invalid) {
        set.status = 422;
        return { error: "คำตอบไม่ตรงกับรูปแบบของข้อนี้" };
      }
      const textAnswer = text === "" ? null : text;
      const hasAnswer = picked.length > 0 || textAnswer !== null;
      const state = body.flagged ? "flagged" : hasAnswer ? "answered" : "untouched";

      // Share-lock the attempt so the write cannot slip in after grading has
      // started, and re-check the deadline under the lock.
      const saved = await db.transaction(async (tx) => {
        const [live] = await tx
          .select({ status: attempts.status, expiresAt: attempts.expiresAt })
          .from(attempts)
          .where(eq(attempts.id, attempt.id))
          .for("share");
        if (!live || live.status !== "in_progress" || live.expiresAt.getTime() <= Date.now()) return false;
        await tx
          .insert(attemptAnswers)
          .values({ attemptId: attempt.id, questionId: params.questionId, selectedChoices: picked, textAnswer, state })
          .onConflictDoUpdate({
            target: [attemptAnswers.attemptId, attemptAnswers.questionId],
            set: { selectedChoices: picked, textAnswer, state, updatedAt: new Date() },
          });
        return true;
      });
      if (!saved) {
        const closed = await ownedAttempt(user.id, attempt.id);
        set.status = 409;
        return { error: CLOSED_ERROR, attempt: closed ? attemptView(closed) : null };
      }

      return {
        answer: { questionId: params.questionId, selectedChoices: picked, textAnswer, state },
        attempt: attemptView(attempt),
      };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        questionId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        selectedChoices: t.Array(t.String({ minLength: 1, maxLength: 4 }), { maxItems: 10 }),
        textAnswer: t.Optional(t.Nullable(t.String({ maxLength: MAX_TEXT_ANSWER }))),
        flagged: t.Boolean(),
      }),
    }
  )
  /**
   * Finish and grade. The body carries nothing: answers are whatever the
   * server already holds. Idempotent — a second submit returns the same
   * score, and an attempt past its deadline is graded as expired instead.
   */
  .post(
    "/:id/submit",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      let attempt = await ownedAttempt(user.id, params.id);
      if (!attempt) {
        set.status = 404;
        return { error: "ไม่พบการทำข้อสอบ" };
      }
      if (attempt.status === "in_progress") {
        await gradeAttempt(attempt.id, "submitted");
        attempt = await ownedAttempt(user.id, params.id);
      }
      return { attempt: attempt ? attemptView(attempt) : null };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  )
  /**
   * Per-question review of a finished attempt: what the student answered,
   * the points it earned and the explanation. Only for packs with
   * showReview on (staff always); the key itself is never sent.
   */
  .get(
    "/:id/review",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const attempt = await ownedAttempt(user.id, params.id);
      if (!attempt) {
        set.status = 404;
        return { error: "ไม่พบการทำข้อสอบ" };
      }
      if (attempt.status === "in_progress") {
        set.status = 409;
        return { error: "ส่งคำตอบก่อนจึงจะดูเฉลยได้" };
      }
      const [pack] = await db
        .select({ showReview: examPacks.showReview })
        .from(examPacks)
        .where(eq(examPacks.id, attempt.packId))
        .limit(1);
      if (!pack?.showReview && !isStaff(user)) {
        set.status = 403;
        return { error: "ชุดนี้ยังไม่เปิดให้ดูเฉลยรายข้อ" };
      }
      const rows = await db
        .select({
          ...studentQuestionColumns,
          explanation: questions.explanation,
          selectedChoices: attemptAnswers.selectedChoices,
          textAnswer: attemptAnswers.textAnswer,
          isCorrect: attemptAnswers.isCorrect,
          pointsAwarded: attemptAnswers.pointsAwarded,
        })
        .from(attemptAnswers)
        .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
        .innerJoin(
          packQuestions,
          and(eq(packQuestions.questionId, questions.id), eq(packQuestions.packId, attempt.packId))
        )
        .where(eq(attemptAnswers.attemptId, attempt.id))
        .orderBy(asc(packQuestions.position));
      return { attempt: attemptView(attempt), questions: rows };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  );
