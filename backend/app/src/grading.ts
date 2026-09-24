import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "./db";
import { attemptAnswers, attempts, packQuestions, questions } from "./db/schema";

/**
 * Server-side grading. This module and /admin are the only code that reads
 * questions.correctChoice; nothing here returns it to a caller.
 */

export type TopicBreakdown = Record<string, { correct: number; total: number }>;
type FinalStatus = "submitted" | "expired";

/**
 * Grade an attempt once. Locks the attempt row so a double submit, or a
 * submit racing the expiry sweep, grades exactly one time; a second call
 * finds the status already final and changes nothing.
 *
 * Grades against the pack's current composition. Every pack question gets
 * an attempt_answers row with isCorrect set; unanswered counts as incorrect.
 */
export async function gradeAttempt(attemptId: string, status: FinalStatus) {
  await db.transaction(async (tx) => {
    const [attempt] = await tx
      .select({ id: attempts.id, packId: attempts.packId, status: attempts.status })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update");
    if (!attempt || attempt.status !== "in_progress") return;

    const key = await tx
      .select({
        questionId: questions.id,
        topic: questions.topic,
        correctChoice: questions.correctChoice,
      })
      .from(packQuestions)
      .innerJoin(questions, eq(questions.id, packQuestions.questionId))
      .where(eq(packQuestions.packId, attempt.packId))
      .orderBy(asc(packQuestions.position));

    const given = await tx
      .select({ questionId: attemptAnswers.questionId, selectedChoice: attemptAnswers.selectedChoice })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId));
    const selected = new Map(given.map((a) => [a.questionId, a.selectedChoice]));

    let score = 0;
    const topicBreakdown: TopicBreakdown = {};
    const rows = key.map((q) => {
      const isCorrect = selected.get(q.questionId) === q.correctChoice;
      if (isCorrect) score += 1;
      const t = (topicBreakdown[q.topic] ??= { correct: 0, total: 0 });
      t.total += 1;
      if (isCorrect) t.correct += 1;
      return { attemptId, questionId: q.questionId, isCorrect };
    });

    if (rows.length > 0) {
      await tx
        .insert(attemptAnswers)
        .values(rows)
        .onConflictDoUpdate({
          target: [attemptAnswers.attemptId, attemptAnswers.questionId],
          set: { isCorrect: sql`excluded.is_correct` },
        });
    }

    await tx
      .update(attempts)
      .set({ status, submittedAt: new Date(), score, topicBreakdown })
      .where(and(eq(attempts.id, attemptId), eq(attempts.status, "in_progress")));
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
