import { Elysia, t } from "elysia";
import { and, asc, count, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { currentUser } from "../auth";
import { db } from "../db";
import {
  attemptAnswers,
  attempts,
  entitlements,
  examPacks,
  packProducts,
  packQuestions,
  questions,
  type UserRole,
} from "../db/schema";
import { gradeAttempt, settleIfExpired } from "../grading";
import { allowedSeconds, getExamSettings } from "../exam-settings";

/**
 * Pack timing as the client may see it. `durationSeconds` is the time the
 * pack was written for; `allowedSeconds` is what the student actually gets
 * after the multiplier in exam_settings is applied.
 */
async function packTiming(pack: { durationSeconds: number }) {
  const settings = await getExamSettings();
  return {
    durationSeconds: pack.durationSeconds,
    timeMultiplierPercent: settings.timeMultiplierPercent,
    allowedSeconds: allowedSeconds(
      pack.durationSeconds,
      settings.timeMultiplierPercent
    ),
  };
}

const packColumns = {
  id: examPacks.id,
  slug: examPacks.slug,
  title: examPacks.title,
  questionCount: examPacks.questionCount,
  durationSeconds: examPacks.durationSeconds,
};

/** Product ids that unlock each pack; a pack absent from the map is free. */
async function unlockingProducts(packIds: string[]) {
  const map = new Map<string, string[]>();
  if (packIds.length === 0) return map;
  const rows = await db
    .select({ packId: packProducts.packId, productId: packProducts.productId })
    .from(packProducts)
    .where(inArray(packProducts.packId, packIds));
  for (const r of rows) map.set(r.packId, [...(map.get(r.packId) ?? []), r.productId]);
  return map;
}

/** Products the user holds a live entitlement on. */
async function liveEntitlementProductIds(userId: string) {
  const rows = await db
    .select({ productId: entitlements.productId })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date()))
      )
    );
  return new Set(rows.map((r) => r.productId));
}

/** Staff and QA accounts open every pack without buying, as in fortune. */
function bypassesPaywall(user: { role: UserRole } | null) {
  return user !== null && (user.role === "admin" || user.role === "dev" || user.role === "test");
}

/** A pack is open when it is free or any unlocking product is entitled. */
function isUnlocked(productIds: string[], owned: Set<string>) {
  return productIds.length === 0 || productIds.some((id) => owned.has(id));
}

const attemptColumns = {
  id: attempts.id,
  packId: attempts.packId,
  status: attempts.status,
  startedAt: attempts.startedAt,
  expiresAt: attempts.expiresAt,
  submittedAt: attempts.submittedAt,
  score: attempts.score,
  topicBreakdown: attempts.topicBreakdown,
};

export const examPacksRoutes = new Elysia({ prefix: "/exam-packs" })
  /**
   * Every pack with the products that unlock it. `unlocked` is computed for
   * the session user when there is one; anonymous callers see only free packs
   * as unlocked. Advisory for the UI — POST /attempts is the real gate.
   */
  .get("/", async ({ headers }) => {
    const rows = await db.select(packColumns).from(examPacks).orderBy(examPacks.title);
    const [settings, unlocks, user] = await Promise.all([
      getExamSettings(),
      unlockingProducts(rows.map((r) => r.id)),
      currentUser(headers),
    ]);
    const owned = user ? await liveEntitlementProductIds(user.id) : new Set<string>();
    const bypass = bypassesPaywall(user);
    return {
      packs: rows.map((pack) => {
        const productIds = unlocks.get(pack.id) ?? [];
        return {
          ...pack,
          productIds,
          unlocked: bypass || isUnlocked(productIds, owned),
          timeMultiplierPercent: settings.timeMultiplierPercent,
          allowedSeconds: allowedSeconds(
            pack.durationSeconds,
            settings.timeMultiplierPercent
          ),
        };
      }),
    };
  })
  .get(
    "/:slug",
    async ({ params, headers, set }) => {
      const [pack] = await db
        .select(packColumns)
        .from(examPacks)
        .where(eq(examPacks.slug, params.slug))
        .limit(1);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      const [unlocks, user] = await Promise.all([
        unlockingProducts([pack.id]),
        currentUser(headers),
      ]);
      const productIds = unlocks.get(pack.id) ?? [];
      const owned = user ? await liveEntitlementProductIds(user.id) : new Set<string>();
      return {
        pack: {
          ...pack,
          productIds,
          unlocked: bypassesPaywall(user) || isUnlocked(productIds, owned),
          ...(await packTiming(pack)),
        },
      };
    },
    { params: t.Object({ slug: t.String({ minLength: 1, maxLength: 80 }) }) }
  );

/** Entitlement gate shared by starting an attempt and serving its questions. */
async function canOpenPack(user: { id: string; role: UserRole }, packId: string) {
  if (bypassesPaywall(user)) return true;
  const productIds = (await unlockingProducts([packId])).get(packId) ?? [];
  if (productIds.length === 0) return true;
  return isUnlocked(productIds, await liveEntitlementProductIds(user.id));
}

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
    allowedSeconds: Math.round(
      (attempt.expiresAt.getTime() - attempt.startedAt.getTime()) / 1000
    ),
    secondsLeft:
      attempt.status === "in_progress"
        ? Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000))
        : 0,
    serverNow: now.toISOString(),
  };
}

/**
 * Question columns a student may see. Never widen this to the whole row:
 * correctChoice and explanation stay on the server.
 */
const studentQuestionColumns = {
  id: questions.id,
  position: packQuestions.position,
  subject: questions.subject,
  topic: questions.topic,
  prompt: questions.prompt,
  imageUrl: questions.imageUrl,
  choices: questions.choices,
};

const CLOSED_ERROR = "หมดเวลาหรือส่งคำตอบชุดนี้แล้ว";

export const attemptsRoutes = new Elysia({ prefix: "/attempts" })
  /**
   * Start an attempt. The deadline is fixed here from the pack duration and
   * the multiplier in exam_settings; the client never supplies time.
   */
  .post(
    "/",
    async ({ body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบก่อนทำข้อสอบ" };
      }

      const [pack] = await db
        .select(packColumns)
        .from(examPacks)
        .where(eq(examPacks.id, body.packId))
        .limit(1);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }

      // Paid packs need a live entitlement on any unlocking product; order
      // status alone is not access.
      if (!(await canOpenPack(user, pack.id))) {
        set.status = 403;
        return { error: "ยังไม่มีสิทธิ์ทำชุดข้อสอบนี้" };
      }

      const [{ n }] = await db
        .select({ n: count() })
        .from(packQuestions)
        .where(eq(packQuestions.packId, pack.id));
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

      // Resume an open attempt instead of stacking a second clock.
      const findOpen = () =>
        db
          .select(attemptColumns)
          .from(attempts)
          .where(
            and(
              eq(attempts.userId, user.id),
              eq(attempts.packId, pack.id),
              eq(attempts.status, "in_progress")
            )
          )
          .limit(1);
      const [open] = await findOpen();
      const timing = await packTiming(pack);
      if (open) {
        return { attempt: { ...attemptView(open), ...timing }, resumed: true };
      }

      // attempts_open_user_pack_key allows one open attempt per user and
      // pack; a concurrent start loses the insert and resumes the winner.
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + timing.allowedSeconds * 1000);
      const [attempt] = await db
        .insert(attempts)
        .values({ userId: user.id, packId: pack.id, startedAt, expiresAt })
        .onConflictDoNothing({
          target: [attempts.userId, attempts.packId],
          where: sql`${attempts.status} = 'in_progress'`,
        })
        .returning(attemptColumns);
      if (!attempt) {
        const [winner] = await findOpen();
        return { attempt: { ...attemptView(winner), ...timing }, resumed: true };
      }

      set.status = 201;
      return { attempt: { ...attemptView(attempt), ...timing }, resumed: false };
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
        .select({ title: examPacks.title, slug: examPacks.slug, durationSeconds: examPacks.durationSeconds })
        .from(examPacks)
        .where(eq(examPacks.id, attempt.packId))
        .limit(1);
      return { attempt: { ...attemptView(attempt), ...pack } };
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
      if (!(await canOpenPack(user, attempt.packId))) {
        set.status = 403;
        return { error: "ยังไม่มีสิทธิ์ทำชุดข้อสอบนี้" };
      }

      const [rows, answers] = await Promise.all([
        db
          .select(studentQuestionColumns)
          .from(packQuestions)
          .innerJoin(questions, eq(questions.id, packQuestions.questionId))
          .where(eq(packQuestions.packId, attempt.packId))
          .orderBy(asc(packQuestions.position)),
        db
          .select({
            questionId: attemptAnswers.questionId,
            selectedChoice: attemptAnswers.selectedChoice,
            state: attemptAnswers.state,
          })
          .from(attemptAnswers)
          .where(eq(attemptAnswers.attemptId, attempt.id)),
      ]);
      return { attempt: attemptView(attempt), questions: rows, answers };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  )
  /**
   * Autosave one question: the full state of that question (choice + flag),
   * so a resend or an out-of-order retry lands on the same row idempotently.
   * Refused once the attempt is closed or the server clock has run out.
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

      // The question must belong to this attempt's pack, and the choice must
      // be one of its own keys.
      const [question] = await db
        .select({ choices: questions.choices })
        .from(packQuestions)
        .innerJoin(questions, eq(questions.id, packQuestions.questionId))
        .where(and(eq(packQuestions.packId, attempt.packId), eq(packQuestions.questionId, params.questionId)))
        .limit(1);
      if (!question) {
        set.status = 404;
        return { error: "ไม่พบข้อนี้ในชุดข้อสอบ" };
      }
      const keys = (question.choices as { key: string }[]).map((c) => c.key);
      if (body.selectedChoice !== null && !keys.includes(body.selectedChoice)) {
        set.status = 422;
        return { error: "ตัวเลือกไม่ถูกต้อง" };
      }

      const state = body.flagged ? "flagged" : body.selectedChoice !== null ? "answered" : "untouched";

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
          .values({ attemptId: attempt.id, questionId: params.questionId, selectedChoice: body.selectedChoice, state })
          .onConflictDoUpdate({
            target: [attemptAnswers.attemptId, attemptAnswers.questionId],
            set: { selectedChoice: body.selectedChoice, state, updatedAt: new Date() },
          });
        return true;
      });
      if (!saved) {
        const closed = await ownedAttempt(user.id, attempt.id);
        set.status = 409;
        return { error: CLOSED_ERROR, attempt: closed ? attemptView(closed) : null };
      }

      return {
        answer: { questionId: params.questionId, selectedChoice: body.selectedChoice, state },
        attempt: attemptView(attempt),
      };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        questionId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        selectedChoice: t.Nullable(t.String({ minLength: 1, maxLength: 4 })),
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
   * Per-question review of a finished attempt: what the student chose,
   * whether it was right, and the explanation. The key itself is still not
   * sent; explanations exist only once the attempt is graded.
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
      const rows = await db
        .select({
          ...studentQuestionColumns,
          explanation: questions.explanation,
          selectedChoice: attemptAnswers.selectedChoice,
          isCorrect: attemptAnswers.isCorrect,
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
