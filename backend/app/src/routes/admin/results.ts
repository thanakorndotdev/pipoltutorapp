import { Elysia, t } from "elysia";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import { PCSHS_CAMPUSES } from "../../campuses";
import { db } from "../../db";
import { attemptAnswers, attempts, examPacks, packQuestions, questions } from "../../db/schema";
import { gradeAttempt, regradePack } from "../../grading";
import { adminGuard } from "./guard";

const idParam = t.Object({ id: t.String({ format: "uuid" }) });

const campusLabel = new Map<string, string>(PCSHS_CAMPUSES.map((c) => [c.code, c.label]));

/** Attempt columns for admin tables; the profile fields are the snapshot taken at start. */
const attemptColumns = {
  id: attempts.id,
  userId: attempts.userId,
  packId: attempts.packId,
  attemptNo: attempts.attemptNo,
  status: attempts.status,
  startedAt: attempts.startedAt,
  expiresAt: attempts.expiresAt,
  submittedAt: attempts.submittedAt,
  score: attempts.score,
  maxScore: attempts.maxScore,
  resetAt: attempts.resetAt,
  scoreHistory: attempts.scoreHistory,
  firstName: attempts.studentFirstName,
  lastName: attempts.studentLastName,
  nickname: attempts.studentNickname,
  campus: attempts.studentCampus,
  email: attempts.studentEmail,
};

/** Pack questions in order with the key, for the detail view and exports. */
async function packKey(packId: string) {
  return db
    .select({
      questionId: questions.id,
      position: packQuestions.position,
      section: packQuestions.section,
      type: questions.type,
      points: questions.points,
      scoring: questions.scoring,
      prompt: questions.prompt,
      choices: questions.choices,
      correctChoices: questions.correctChoices,
      acceptedAnswers: questions.acceptedAnswers,
      updatedAt: questions.updatedAt,
    })
    .from(packQuestions)
    .innerJoin(questions, eq(questions.id, packQuestions.questionId))
    .where(eq(packQuestions.packId, packId))
    .orderBy(asc(packQuestions.position));
}

// --- CSV --------------------------------------------------------------------

/** Bangkok wall-clock time, which is what Excel shows the team. */
const bkk = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const ts = (d: Date | null) => (d ? bkk.format(d) : "");

/**
 * One CSV cell. Text that Excel would read as a formula is prefixed with an
 * apostrophe (CSV injection); numbers are written bare so they stay numbers.
 */
function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** UTF-8 BOM so Excel opens Thai text correctly; CRLF rows. */
function csv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

const STATUS_LABEL = { in_progress: "กำลังทำ", submitted: "ส่งแล้ว", expired: "หมดเวลา" } as const;

const answerText = (a: { selectedChoices: string[]; textAnswer: string | null } | undefined) =>
  a ? (a.textAnswer ?? a.selectedChoices.join("|")) : "";

const secondsUsed = (a: { startedAt: Date; submittedAt: Date | null }) =>
  a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000) : null;

/** Student and attempt columns shared by every export format. */
const SUMMARY_HEADER = [
  "attempt_id",
  "user_id",
  "exam_id",
  "exam_slug",
  "attempt_no",
  "started_at",
  "submitted_at",
  "seconds_used",
  "status",
  "first_name",
  "last_name",
  "nickname",
  "campus",
  "email",
  "score",
  "max_score",
  "original_score",
  "reset",
];

type ExportAttempt = Awaited<ReturnType<typeof loadExportAttempts>>[number];

function summaryCells(a: ExportAttempt, pack: { id: string; slug: string }) {
  const history = Array.isArray(a.scoreHistory) ? (a.scoreHistory as { score: number | null }[]) : [];
  return [
    a.id,
    a.userId,
    pack.id,
    pack.slug,
    a.attemptNo,
    ts(a.startedAt),
    ts(a.submittedAt),
    secondsUsed(a),
    STATUS_LABEL[a.status],
    a.firstName,
    a.lastName,
    a.nickname,
    a.campus ? (campusLabel.get(a.campus) ?? a.campus) : "",
    a.email,
    a.score,
    a.maxScore,
    // The score before the first regrade, so a changed result can be traced.
    history.length > 0 ? history[0]!.score : a.score,
    a.resetAt ? `reset ${ts(a.resetAt)}` : "",
  ];
}

async function loadExportAttempts(packId: string) {
  return db.select(attemptColumns).from(attempts).where(eq(attempts.packId, packId)).orderBy(asc(attempts.startedAt));
}

async function loadAnswers(attemptIds: string[]) {
  const map = new Map<string, Map<string, { selectedChoices: string[]; textAnswer: string | null; pointsAwarded: number | null; updatedAt: Date }>>();
  if (attemptIds.length === 0) return map;
  const rows = await db
    .select({
      attemptId: attemptAnswers.attemptId,
      questionId: attemptAnswers.questionId,
      selectedChoices: attemptAnswers.selectedChoices,
      textAnswer: attemptAnswers.textAnswer,
      pointsAwarded: attemptAnswers.pointsAwarded,
      updatedAt: attemptAnswers.updatedAt,
    })
    .from(attemptAnswers)
    .where(inArray(attemptAnswers.attemptId, attemptIds));
  for (const { attemptId, questionId, ...rest } of rows) {
    const m = map.get(attemptId) ?? new Map();
    m.set(questionId, rest);
    map.set(attemptId, m);
  }
  return map;
}

export const adminResultsRoutes = new Elysia({ prefix: "/admin" })
  .use(adminGuard)
  /** Every attempt on a pack, newest first, with the student snapshot. */
  .get(
    "/packs/:id/attempts",
    async ({ params, set }) => {
      const [pack] = await db
        .select({ id: examPacks.id, title: examPacks.title, slug: examPacks.slug, maxAttempts: examPacks.maxAttempts, closesAt: examPacks.closesAt })
        .from(examPacks)
        .where(eq(examPacks.id, params.id))
        .limit(1);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      const rows = await db.select(attemptColumns).from(attempts).where(eq(attempts.packId, params.id)).orderBy(desc(attempts.startedAt));
      return { pack, attempts: rows };
    },
    { params: idParam }
  )
  /** One attempt with every answer, the key and the points per question. */
  .get(
    "/attempts/:id",
    async ({ params, set }) => {
      const [attempt] = await db.select(attemptColumns).from(attempts).where(eq(attempts.id, params.id)).limit(1);
      if (!attempt) {
        set.status = 404;
        return { error: "ไม่พบการทำข้อสอบ" };
      }
      const [pack] = await db.select({ title: examPacks.title, slug: examPacks.slug }).from(examPacks).where(eq(examPacks.id, attempt.packId)).limit(1);
      const [key, answers] = await Promise.all([packKey(attempt.packId), loadAnswers([attempt.id])]);
      const mine = answers.get(attempt.id) ?? new Map();
      return {
        attempt: { ...attempt, pack },
        questions: key.map((q) => {
          const a = mine.get(q.questionId);
          return {
            ...q,
            selectedChoices: a?.selectedChoices ?? [],
            textAnswer: a?.textAnswer ?? null,
            pointsAwarded: a?.pointsAwarded ?? null,
            answeredAt: a?.updatedAt ?? null,
          };
        }),
      };
    },
    { params: idParam }
  )
  /**
   * Give a student their attempts back on one pack. Any open attempt is
   * graded first; every attempt is kept with resetAt set and stops counting
   * toward maxAttempts, so the next start creates a new attempt.
   */
  .post(
    "/packs/:id/reset",
    async ({ params, body }) => {
      const open = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(and(eq(attempts.packId, params.id), eq(attempts.userId, body.userId), eq(attempts.status, "in_progress")));
      for (const a of open) await gradeAttempt(a.id, "submitted");
      const reset = await db
        .update(attempts)
        .set({ resetAt: new Date() })
        .where(and(eq(attempts.packId, params.id), eq(attempts.userId, body.userId), isNull(attempts.resetAt), ne(attempts.status, "in_progress")))
        .returning({ id: attempts.id });
      return { reset: reset.length };
    },
    { params: idParam, body: t.Object({ userId: t.String({ format: "uuid" }) }) }
  )
  /**
   * Re-mark finished attempts against the current key and points. `apply`
   * false is the preview; true writes new scores and keeps the old ones in
   * scoreHistory.
   */
  .post(
    "/packs/:id/regrade",
    async ({ params, body }) => regradePack(params.id, body.apply),
    { params: idParam, body: t.Object({ apply: t.Boolean() }) }
  )
  /**
   * RAW_DATA export. summary: one row per attempt. wide: one row per attempt
   * with an answer and a points column per question. long: one row per
   * attempt × question. Opens in Excel with Thai intact (UTF-8 BOM).
   */
  .get(
    "/packs/:id/export",
    async ({ params, query, set }) => {
      const [pack] = await db.select({ id: examPacks.id, slug: examPacks.slug }).from(examPacks).where(eq(examPacks.id, params.id)).limit(1);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      const format = query.format ?? "summary";
      const rows = await loadExportAttempts(pack.id);
      let body: string;
      if (format === "summary") {
        body = csv(SUMMARY_HEADER, rows.map((a) => summaryCells(a, pack)));
      } else {
        const [key, answers] = await Promise.all([packKey(pack.id), loadAnswers(rows.map((r) => r.id))]);
        if (format === "wide") {
          const header = [...SUMMARY_HEADER, ...key.flatMap((q) => [`q${q.position}_answer`, `q${q.position}_points`])];
          body = csv(
            header,
            rows.map((a) => {
              const mine = answers.get(a.id);
              return [
                ...summaryCells(a, pack),
                ...key.flatMap((q) => {
                  const ans = mine?.get(q.questionId);
                  return [answerText(ans), ans?.pointsAwarded ?? null];
                }),
              ];
            })
          );
        } else {
          const header = [
            ...SUMMARY_HEADER,
            "question_id",
            "question_no",
            "section",
            "question_type",
            // updatedAt of the question: changes when its wording or key is edited.
            "question_version",
            "answer",
            "points_awarded",
            "points_max",
          ];
          const out: (string | number | null)[][] = [];
          for (const a of rows) {
            const mine = answers.get(a.id);
            const base = summaryCells(a, pack);
            for (const q of key) {
              const ans = mine?.get(q.questionId);
              out.push([...base, q.questionId, q.position, q.section, q.type, ts(q.updatedAt), answerText(ans), ans?.pointsAwarded ?? null, q.points]);
            }
          }
          body = csv(header, out);
        }
      }
      const stamp = ts(new Date()).replace(" ", "_").replace(/:/g, "").slice(0, 15);
      return new Response(body, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${pack.slug}-${format}-${stamp}.csv"`,
          "cache-control": "no-store",
        },
      });
    },
    {
      params: idParam,
      query: t.Object({ format: t.Optional(t.Union([t.Literal("summary"), t.Literal("wide"), t.Literal("long")])) }),
    }
  );
