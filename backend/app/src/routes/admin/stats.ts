import { Elysia } from "elysia";
import { and, avg, count, desc, eq, gte, isNull, or, sql, sum, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "../../db";
import {
  attempts,
  entitlements,
  examPacks,
  orders,
  packQuestions,
  products,
  questions,
  users,
} from "../../db/schema";
import { adminGuard } from "./guard";

const DAYS = 14;
const DAY_MS = 86_400_000;

/** YYYY-MM-DD in Bangkok time, the grain every per-day series uses. */
const bangkokDay = (col: PgColumn) =>
  sql<string>`to_char((${col} at time zone 'Asia/Bangkok')::date, 'YYYY-MM-DD')`;

async function perDay(table: PgTable, col: PgColumn, since: Date, extra?: SQL) {
  const day = bangkokDay(col);
  return db
    .select({ day, n: count() })
    .from(table)
    .where(and(gte(col, since), extra))
    .groupBy(day)
    .orderBy(day);
}

/** Zero-filled series for the last DAYS days ending today (Bangkok). */
function fillSeries(rows: { day: string; n: number }[], since: Date) {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.n)]));
  const out: { day: string; n: number }[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });
  for (let i = 0; i < DAYS; i++) {
    const day = fmt.format(new Date(since.getTime() + i * DAY_MS));
    out.push({ day, n: byDay.get(day) ?? 0 });
  }
  return out;
}

export const adminStatsRoutes = new Elysia({ prefix: "/admin/stats" })
  .use(adminGuard)
  .get("/", async () => {
    const now = new Date();
    const since = new Date(now.getTime() - (DAYS - 1) * DAY_MS);
    since.setUTCHours(0, 0, 0, 0);

    const [
      [userTotals],
      [orderTotals],
      [paidTotals],
      [attemptTotals],
      [submittedTotals],
      [entitlementTotals],
      [questionTotals],
      packs,
      ordersByStatus,
      signups,
      attemptsStarted,
      paidOrders,
      recentOrders,
    ] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(orders),
      db
        .select({ total: count(), revenueSatang: sum(orders.amountSatang) })
        .from(orders)
        .where(eq(orders.status, "paid")),
      db.select({ total: count() }).from(attempts),
      db
        .select({ total: count(), avgScore: avg(attempts.score) })
        .from(attempts)
        .where(eq(attempts.status, "submitted")),
      db
        .select({ total: count() })
        .from(entitlements)
        .where(or(isNull(entitlements.expiresAt), gte(entitlements.expiresAt, now))),
      db
        .select({ total: count(), active: sum(sql<number>`case when ${questions.active} then 1 else 0 end`) })
        .from(questions),
      db
        .select({
          id: examPacks.id,
          slug: examPacks.slug,
          title: examPacks.title,
          questionCount: examPacks.questionCount,
          assigned: count(packQuestions.id),
        })
        .from(examPacks)
        .leftJoin(packQuestions, eq(packQuestions.packId, examPacks.id))
        .groupBy(examPacks.id)
        .orderBy(examPacks.title),
      db
        .select({ status: orders.status, n: count() })
        .from(orders)
        .groupBy(orders.status),
      perDay(users, users.createdAt, since),
      perDay(attempts, attempts.startedAt, since),
      perDay(orders, orders.paidAt, since, eq(orders.status, "paid")),
      db
        .select({
          id: orders.id,
          status: orders.status,
          amountSatang: orders.amountSatang,
          studentName: orders.studentName,
          productTitle: products.title,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .innerJoin(products, eq(products.id, orders.productId))
        .orderBy(desc(orders.createdAt))
        .limit(8),
    ]);

    return {
      generatedAt: now.toISOString(),
      totals: {
        users: Number(userTotals?.total ?? 0),
        orders: Number(orderTotals?.total ?? 0),
        paidOrders: Number(paidTotals?.total ?? 0),
        revenueSatang: Number(paidTotals?.revenueSatang ?? 0),
        attempts: Number(attemptTotals?.total ?? 0),
        submittedAttempts: Number(submittedTotals?.total ?? 0),
        avgScore: submittedTotals?.avgScore === null || submittedTotals?.avgScore === undefined
          ? null
          : Number(submittedTotals.avgScore),
        activeEntitlements: Number(entitlementTotals?.total ?? 0),
        questions: Number(questionTotals?.total ?? 0),
        activeQuestions: Number(questionTotals?.active ?? 0),
      },
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((r) => [r.status, Number(r.n)])
      ),
      series: {
        days: DAYS,
        signups: fillSeries(signups, since),
        attempts: fillSeries(attemptsStarted, since),
        paidOrders: fillSeries(paidOrders, since),
      },
      packs: packs.map((p) => ({ ...p, assigned: Number(p.assigned) })),
      recentOrders,
    };
  });
