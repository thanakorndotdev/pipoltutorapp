import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "./db";
import { attemptAnswers, attempts, packQuestions, questions } from "./db/schema";
import { scoreAnswer, sumPoints, type GivenAnswer } from "./scoring";

/**
 * Server-side grading. This module and /admin are the only code that reads
 * the answer key; nothing here returns it to a caller.
 */

export type TopicBreakdown = Record<string, { correct: number; total: number; points: number; maxPoints: number }>;
type FinalStatus = "submitted" | "expired";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Mark every pack question against the stored answers. Unanswered counts as
 * 0 points. Grades against the pack's current composition and key, which is
 * what makes a regrade after a key fix possible.
 */
async function markAttempt(tx: Tx, attemptId: string, packId: string) {
  const key = await tx
    .select({
      questionId: questions.id,
      topic: questions.topic,
      type: questions.type,
      points: questions.points,
      scoring: questions.scoring,
      correctChoices: questions.correctChoices,
      acceptedAnswers: questions.acceptedAnswers,
    })
    .from(packQuestions)
    .innerJoin(questions, eq(questions.id, packQuestions.questionId))
    .where(eq(packQuestions.packId, packId))
    .orderBy(asc(packQuestions.position));

  const given = await tx
    .select({
      questionId: attemptAnswers.questionId,
      selectedChoices: attemptAnswers.selectedChoices,
      textAnswer: attemptAnswers.textAnswer,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));
  const byQuestion = new Map<string, GivenAnswer>(given.map((a) => [a.questionId, a]));

  const topicBreakdown: TopicBreakdown = {};
  const rows = key.map((q) => {
    const pointsAwarded = scoreAnswer(q, byQuestion.get(q.questionId));
    const isCorrect = pointsAwarded >= q.points;
    const t = (topicBreakdown[q.topic] ??= { correct: 0, total: 0, points: 0, maxPoints: 0 });
    t.total += 1;
    t.maxPoints = sumPoints([t.maxPoints, q.points]);
    t.points = sumPoints([t.points, pointsAwarded]);
    if (isCorrect) t.correct += 1;
    return { attemptId, questionId: q.questionId, isCorrect, pointsAwarded };
  });

  return {
    rows,
    topicBreakdown,
    score: sumPoints(rows.map((r) => r.pointsAwarded)),
    maxScore: sumPoints(key.map((q) => q.points)),
  };
}

async function writeMarks(tx: Tx, rows: Awaited<ReturnType<typeof markAttempt>>["rows"]) {
  if (rows.length === 0) return;
  await tx
    .insert(attemptAnswers)
    .values(rows)
    .onConflictDoUpdate({
      target: [attemptAnswers.attemptId, attemptAnswers.questionId],
      set: { isCorrect: sql`excluded.is_correct`, pointsAwarded: sql`excluded.points_awarded` },
    });
}

/**
 * Grade an attempt once. Locks the attempt row so a double submit, or a
 * submit racing the expiry sweep, grades exactly one time; a second call
 * finds the status already final and changes nothing.
 */
export async function gradeAttempt(attemptId: string, status: FinalStatus) {
  await db.transaction(async (tx) => {
    const [attempt] = await tx
      .select({ id: attempts.id, packId: attempts.packId, status: attempts.status })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update");
    if (!attempt || attempt.status !== "in_progress") return;

    const { rows, topicBreakdown, score, maxScore } = await markAttempt(tx, attemptId, attempt.packId);
    await writeMarks(tx, rows);
    await tx
      .update(attempts)
      .set({ status, submittedAt: new Date(), score, maxScore, topicBreakdown })
      .where(and(eq(attempts.id, attemptId), eq(attempts.status, "in_progress")));
  });
}

export type RegradeChange = {
  attemptId: string;
  oldScore: number | null;
  newScore: number;
  oldMaxScore: number | null;
  newMaxScore: number;
};

/**
 * Re-mark every finished attempt of a pack against the current key and
 * points. With `apply` false nothing is written and the result is a
 * preview; with `apply` true each changed attempt gets its new score and the
 * old one is appended to scoreHistory. Answers themselves are never touched.
 */
export async function regradePack(packId: string, apply: boolean) {
  return db.transaction(async (tx) => {
    const finished = await tx
      .select({
        id: attempts.id,
        score: attempts.score,
        maxScore: attempts.maxScore,
        scoreHistory: attempts.scoreHistory,
      })
      .from(attempts)
      .where(and(eq(attempts.packId, packId), ne(attempts.status, "in_progress")))
      .for(apply ? "update" : "share");

    const changes: RegradeChange[] = [];
    for (const a of finished) {
      const marked = await markAttempt(tx, a.id, packId);
      const changed = a.score !== marked.score || a.maxScore !== marked.maxScore;
      if (changed) {
        changes.push({ attemptId: a.id, oldScore: a.score, newScore: marked.score, oldMaxScore: a.maxScore, newMaxScore: marked.maxScore });
      }
      if (!apply) continue;
      await writeMarks(tx, marked.rows);
      if (!changed) continue;
      const history = Array.isArray(a.scoreHistory) ? a.scoreHistory : [];
      await tx
        .update(attempts)
        .set({
          score: marked.score,
          maxScore: marked.maxScore,
          topicBreakdown: marked.topicBreakdown,
          scoreHistory: [...history, { score: a.score, maxScore: a.maxScore, at: new Date().toISOString() }],
        })
        .where(eq(attempts.id, a.id));
    }
    return { checked: finished.length, changes };
  });
}

/**
 * The clock rule: an in_progress attempt past its deadline is graded as
 * expired on the first request that touches it. Returns true when it did.
 */
export async function settleIfExpired(attempt: {
  id: string;
  status: string;
  expiresAt: Date;
}) {
  if (attempt.status !== "in_progress" || attempt.expiresAt.getTime() > Date.now()) return false;
  await gradeAttempt(attempt.id, "expired");
  return true;
}

/** Attempts that count against a pack's limit: every one not reset by an admin. */
export const countsTowardLimit = (userId: string, packId: string) =>
  and(eq(attempts.userId, userId), eq(attempts.packId, packId), isNull(attempts.resetAt));
