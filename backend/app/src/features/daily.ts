import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { attempts, attemptAnswers, questions } from "../db/schema";
import {
  dailyAssignments,
  dailyChallenges,
  dailyExtensions,
  dailyResponses,
  fireLedger,
  fireRecovery,
  fireSummary,
  type DailyAnswer,
  type DailyQuestion,
} from "../db/features";
import { scoreAnswer } from "../scoring";
import {
  addDays,
  bangkokDay,
  endOfDay,
  fail,
  hash,
  lock,
  type Tx,
} from "./common";

export const recoveryCap = (current: number) =>
  current >= 50 ? 6 : current >= 30 ? 5 : current >= 10 ? 4 : 3;
type Reader = Pick<Tx, "select">;
/** Latest active FIRE-12 extension deadline covering this learner and day. */
export async function extensionFor(
  tx: Reader,
  userId: string | null,
  date: string,
  now = new Date(),
) {
  if (!userId) return null;
  const rows = await tx
    .select()
    .from(dailyExtensions)
    .where(and(eq(dailyExtensions.date, date), gt(dailyExtensions.until, now)));
  const until = rows
    .filter((r) => !r.userIds || r.userIds.includes(userId))
    .map((r) => r.until.getTime());
  return until.length ? new Date(Math.max(...until)) : null;
}
/** Days whose answer key and archive copy must wait for an active extension. */
export async function heldDates(tx: Reader, now = new Date()) {
  const rows = await tx
    .select({ date: dailyExtensions.date })
    .from(dailyExtensions)
    .where(gt(dailyExtensions.until, now));
  return new Set(rows.map((r) => r.date));
}
export async function ensureDay(tx: Tx, date: string) {
  await lock(tx, `daily:${date}`);
  const [existing] = await tx
    .select()
    .from(dailyAssignments)
    .where(eq(dailyAssignments.date, date));
  if (existing) {
    if (!existing.challengeId && date === bangkokDay()) {
      const [fixed] = await tx
        .select()
        .from(dailyChallenges)
        .where(
          and(
            eq(dailyChallenges.date, date),
            eq(dailyChallenges.status, "scheduled"),
          ),
        );
      if (fixed) {
        const [updated] = await tx
          .update(dailyAssignments)
          .set({
            challengeId: fixed.id,
            title: fixed.title,
            questions: fixed.questions,
            revision: fixed.revision,
          })
          .where(eq(dailyAssignments.date, date))
          .returning();
        return updated!;
      }
    }
    return existing;
  }
  const [fixed] = await tx
    .select()
    .from(dailyChallenges)
    .where(
      and(
        eq(dailyChallenges.date, date),
        inArray(dailyChallenges.status, ["scheduled", "active"]),
      ),
    );
  const [queued] = fixed
    ? []
    : await tx
        .select()
        .from(dailyChallenges)
        .where(
          and(
            isNull(dailyChallenges.date),
            eq(dailyChallenges.status, "scheduled"),
            sql`not exists (select 1 from daily_assignments d where d.challenge_id = daily_challenges.id)`,
          ),
        )
        .orderBy(
          asc(dailyChallenges.queueOrder),
          asc(dailyChallenges.createdAt),
        )
        .limit(1);
  const chosen = fixed ?? queued;
  const [row] = await tx
    .insert(dailyAssignments)
    .values({
      date,
      challengeId: chosen?.id ?? null,
      title: chosen?.title ?? "วันนี้ไม่มีโจทย์ ระบบรักษาไฟให้อัตโนมัติ",
      questions: chosen?.questions ?? [],
      revision: chosen?.revision ?? 1,
    })
    .returning();
  return row!;
}
async function ledger(
  tx: Tx,
  userId: string,
  date: string,
  state: string,
  source: string,
  increment = 0,
  previousCurrent: number | null = null,
) {
  await tx
    .insert(fireLedger)
    .values({ userId, date, state, source, increment, previousCurrent })
    .onConflictDoUpdate({
      target: [fireLedger.userId, fireLedger.date],
      set: { state, source, increment, previousCurrent },
    });
}
/** Call only while holding fire:user lock; all increments/recoveries share it. */
export async function settleFire(tx: Tx, userId: string, now = new Date()) {
  await lock(tx, `fire:${userId}`);
  const today = bangkokDay(now),
    yesterday = addDays(today, -1);
  await tx
    .insert(fireSummary)
    .values({ userId, lastDate: today })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(fireSummary)
    .where(eq(fireSummary.userId, userId))
    .for("update");
  const s = { ...row! };
  if (s.pendingDate && s.pendingDate < yesterday) {
    await ledger(
      tx,
      userId,
      s.pendingDate,
      "lost",
      "recovery_expired",
      0,
      s.current,
    );
    s.current = 0;
    s.pendingDate = null;
  }
  // At most the preceding 370 days need evaluation; an older missed challenge already resets current.
  let start = s.lastDate;
  if (start < addDays(today, -370)) {
    s.current = 0;
    start = addDays(today, -370);
  }
  let settledTo = today;
  for (let d = start; d < today; d = addDays(d, 1)) {
    // An approved extension keeps this day open; evaluate it after the window.
    if (await extensionFor(tx, userId, d, now)) {
      settledTo = d;
      break;
    }
    const [event] = await tx
      .select()
      .from(fireLedger)
      .where(and(eq(fireLedger.userId, userId), eq(fireLedger.date, d)));
    if (event && !["pending", "lost"].includes(event.state)) continue;
    const day = await ensureDay(tx, d);
    const responses = await tx
      .select()
      .from(dailyResponses)
      .where(
        and(eq(dailyResponses.userId, userId), eq(dailyResponses.date, d)),
      );
    const attemptedAll =
      day.questions.length > 1 &&
      day.questions.every((q) => responses.some((r) => r.questionId === q.id));
    const exhausted = day.questions.length === 1 && responses.length >= 2;
    if (day.questions.length === 0 || attemptedAll || exhausted) {
      await ledger(
        tx,
        userId,
        d,
        day.questions.length ? "protected" : "auto_protected",
        "cutoff",
      );
      continue;
    }
    if (d === yesterday && s.current > 0) {
      s.pendingDate = d;
      await ledger(tx, userId, d, "pending", "missed");
    } else {
      await ledger(tx, userId, d, "lost", "missed", 0, s.current);
      s.current = 0;
    }
  }
  s.lastDate = settledTo;
  if (
    s.current !== row!.current ||
    s.highest !== row!.highest ||
    s.pendingDate !== row!.pendingDate ||
    s.lastDate !== row!.lastDate
  ) {
    s.version++;
    await tx.update(fireSummary).set(s).where(eq(fireSummary.userId, userId));
  }
  return s;
}
export async function fireViewTx(tx: Tx, userId: string, now = new Date()) {
  const s = await settleFire(tx, userId, now),
    today = bangkokDay(now);
  const used = await tx
    .select()
    .from(fireRecovery)
    .where(
      and(
        eq(fireRecovery.userId, userId),
        eq(fireRecovery.month, today.slice(0, 7)),
        eq(fireRecovery.usedQuota, true),
      ),
    );
  const [event] = await tx
    .select()
    .from(fireLedger)
    .where(and(eq(fireLedger.userId, userId), eq(fireLedger.date, today)));
  return {
    current: s.current,
    highest: s.highest,
    pendingDate: s.pendingDate,
    pendingDeadline: s.pendingDate ? endOfDay(today).toISOString() : null,
    remaining: Math.max(0, recoveryCap(s.current) - used.length),
    cap: recoveryCap(s.current),
    used: used.length,
    todayState: event?.state ?? "incomplete",
    version: s.version,
  };
}
export const getFire = (userId: string, now = new Date()) =>
  db.transaction((tx) => fireViewTx(tx, userId, now));
async function increase(
  tx: Tx,
  userId: string,
  date: string,
  s: typeof fireSummary.$inferSelect,
) {
  const [event] = await tx
    .select()
    .from(fireLedger)
    .where(and(eq(fireLedger.userId, userId), eq(fireLedger.date, date)));
  if (event?.increment === 1) return;
  await ledger(tx, userId, date, "increased", "daily", 1);
  const current = s.current + 1;
  await tx
    .update(fireSummary)
    .set({
      current,
      highest: Math.max(s.highest, current),
      version: s.version + 1,
    })
    .where(eq(fireSummary.userId, userId));
}
export function validateAnswer(q: DailyQuestion, answer: DailyAnswer) {
  if (q.type === "short") {
    if (answer.selectedChoices.length || !answer.textAnswer?.trim())
      fail("กรอกคำตอบแบบข้อความ");
  } else if (
    answer.textAnswer ||
    !answer.selectedChoices.length ||
    new Set(answer.selectedChoices).size !== answer.selectedChoices.length ||
    answer.selectedChoices.some((k) => !q.choices.some((c) => c.key === k)) ||
    (q.type === "single" && answer.selectedChoices.length !== 1)
  )
    fail("คำตอบไม่ตรงรูปแบบโจทย์");
}
export const correctAnswer = (q: DailyQuestion, answer: DailyAnswer) =>
  scoreAnswer({ ...q, points: 1, scoring: "exact" }, answer) === 1;
export async function submitDaily(
  userId: string,
  date: string,
  questionId: string,
  answer: DailyAnswer,
  requestId: string,
  clock?: Date,
) {
  return db.transaction(async (tx) => {
    const now = clock ?? new Date();
    const s = await settleFire(tx, userId, now);
    const extended = await extensionFor(tx, userId, date, now);
    if (
      !extended &&
      (date !== bangkokDay(now) || (!clock && date !== bangkokDay(new Date())))
    )
      fail("โจทย์ประจำวันเดิมปิดรับคำตอบแล้ว คุณยังสามารถฝึกย้อนหลังได้ในคลังข้อสอบ", 409);
    const [duplicate] = await tx
      .select()
      .from(dailyResponses)
      .where(
        and(
          eq(dailyResponses.userId, userId),
          eq(dailyResponses.requestId, requestId),
        ),
      );
    if (duplicate) {
      if (
        duplicate.date !== date ||
        duplicate.questionId !== questionId ||
        hash(duplicate.answer) !== hash(answer)
      )
        fail("รหัสคำขอถูกใช้กับคำตอบอื่นแล้ว", 409);
      return {
        correct: duplicate.correct,
        tryNo: duplicate.tryNo,
        duplicate: true,
      };
    }
    const day = await ensureDay(tx, date),
      q = day.questions.find((q) => q.id === questionId);
    if (!q) fail("ไม่พบโจทย์", 404);
    validateAnswer(q!, answer);
    const all = await tx
      .select()
      .from(dailyResponses)
      .where(
        and(eq(dailyResponses.userId, userId), eq(dailyResponses.date, date)),
      );
    const own = all.filter((r) => r.questionId === questionId);
    if (own.length >= 2 || own.some((r) => r.correct))
      fail("หมดโอกาสตอบข้อนี้แล้ว", 409);
    // Recheck real server arrival time after locks; tests explicitly inject a clock.
    const closes = Math.max(endOfDay(date).getTime(), extended?.getTime() ?? 0);
    if (closes <= now.getTime()) fail("โจทย์ประจำวันปิดรับแล้ว", 409);
    const correct = correctAnswer(q!, answer),
      hintShown = !correct && own.length === 0 && q!.showHint;
    const [response] = await tx
      .insert(dailyResponses)
      .values({
        userId,
        date,
        questionId,
        tryNo: own.length + 1,
        requestId,
        answer,
        correct,
        hintShown,
      })
      .returning();
    const combined = [...all, response!];
    if (
      day.questions.every((q) =>
        combined.some((r) => r.questionId === q.id && r.correct),
      )
    )
      await increase(tx, userId, date, s);
    else if (
      (day.questions.length === 1 && combined.length >= 2) ||
      (day.questions.length > 1 &&
        day.questions.every((q) => combined.some((r) => r.questionId === q.id)))
    ) {
      const [event] = await tx
        .select()
        .from(fireLedger)
        .where(and(eq(fireLedger.userId, userId), eq(fireLedger.date, date)));
      if (event?.increment !== 1)
        await ledger(
          tx,
          userId,
          date,
          "protected",
          day.questions.length > 1 ? "daily_attempted_all" : "daily_exhausted",
        );
    }
    return {
      correct,
      tryNo: own.length + 1,
      hint: hintShown ? q!.hint : null,
      duplicate: false,
    };
  });
}
export async function dailyView(
  userId: string | null,
  date: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const day = await ensureDay(tx, date);
    const held = (await heldDates(tx, now)).has(date),
      extendedUntil = await extensionFor(tx, userId, date, now),
      past = date < bangkokDay(now) && !held;
    const responses = userId
      ? await tx
          .select()
          .from(dailyResponses)
          .where(
            and(
              eq(dailyResponses.userId, userId),
              eq(dailyResponses.date, date),
            ),
          )
      : [];
    return {
      date,
      title: day.title,
      archive: past,
      extendedUntil: extendedUntil?.toISOString() ?? null,
      questions: day.questions.map((q) => {
        const own = responses.filter((r) => r.questionId === q.id),
          finished = own.length >= 2 || own.some((r) => r.correct);
        const reveal = past || (q.reveal === "finished" && finished);
        return {
          id: q.id,
          type: q.type,
          subject: q.subject,
          topic: q.topic,
          prompt: q.prompt,
          choices: q.choices,
          tries: own.length,
          correct: own.some((r) => r.correct),
          lastAnswer: own.at(-1)?.answer ?? null,
          hint: own.some((r) => r.hintShown) ? q.hint : null,
          ...(reveal
            ? {
                correctChoices: q.correctChoices,
                acceptedAnswers: q.acceptedAnswers,
                explanation: q.explanation,
              }
            : {}),
        };
      }),
    };
  });
}
export async function recover(userId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const state = await fireViewTx(tx, userId, now);
    if (!state.pendingDate || state.remaining <= 0)
      fail("ไม่มีวันที่กู้ได้หรือสิทธิ์กู้หมดแล้ว", 409);
    const date = bangkokDay(now);
    await tx.insert(fireRecovery).values({
      userId,
      missedDate: state.pendingDate!,
      month: date.slice(0, 7),
    });
    await ledger(tx, userId, state.pendingDate!, "recovered", "quota");
    await tx
      .update(fireSummary)
      .set({ pendingDate: null, version: sql`${fireSummary.version}+1` })
      .where(eq(fireSummary.userId, userId));
    return fireViewTx(tx, userId, now);
  });
}
export async function protectByExam(attemptId: string) {
  const [a] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId));
  if (!a || a.status === "in_progress") return;
  const given = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));
  if (!given.some((g) => g.selectedChoices.length || g.textAnswer?.trim()))
    return;
  await db.transaction(async (tx) => {
    await settleFire(tx, a.userId);
    const date = bangkokDay(
      a.status === "expired" ? a.expiresAt : (a.submittedAt ?? new Date()),
    );
    const [event] = await tx
      .select()
      .from(fireLedger)
      .where(and(eq(fireLedger.userId, a.userId), eq(fireLedger.date, date)));
    if (!event || ["pending", "lost"].includes(event.state))
      await ledger(tx, a.userId, date, "protected_by_exam", attemptId);
  });
}
export async function archiveDaily(now = new Date()) {
  await db.transaction(async (tx) => {
    await lock(tx, "daily:archive");
    const held = await heldDates(tx, now);
    const days = await tx
      .select()
      .from(dailyAssignments)
      .where(
        and(
          lt(dailyAssignments.date, bangkokDay(now)),
          isNull(dailyAssignments.archivedQuestionIds),
        ),
      );
    for (const day of days) {
      // The answer key stays private until an approved extension closes.
      if (held.has(day.date)) continue;
      const ids: string[] = [];
      for (const q of day.questions) {
        const [row] = await tx
          .insert(questions)
          .values({
            subject: q.subject,
            topic: `โจทย์ประจำวัน · ${q.topic}`,
            prompt: q.prompt,
            type: q.type,
            choices: q.choices,
            correctChoices: q.correctChoices,
            acceptedAnswers: q.acceptedAnswers,
            explanation: q.explanation,
            points: 1,
            scoring: "exact",
          })
          .returning({ id: questions.id });
        ids.push(row!.id);
      }
      await tx
        .update(dailyAssignments)
        .set({ archivedQuestionIds: ids })
        .where(eq(dailyAssignments.date, day.date));
    }
  });
}
