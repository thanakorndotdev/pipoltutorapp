import { Elysia } from "elysia";
import { eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { articles, certificateJobs } from "../db/schema";
import {
  comments,
  dailyAssignments,
  fireLedger,
  fireSummary,
} from "../db/features";
import { settings, publicSnapshot } from "../features/cms";
import { bangkokDay } from "../features/common";
import { adminGuard } from "./admin/guard";
export const homeRoutes = new Elysia().get("/site/home", async () => ({
  sections: await settings("cms.home", []),
}));
export const moduleHealthRoutes = new Elysia({ prefix: "/admin/module-health" })
  .use(adminGuard)
  .get("/", async () => {
    const jobs = await db
      .select({ status: certificateJobs.status, n: sql<number>`count(*)::int` })
      .from(certificateJobs)
      .groupBy(certificateJobs.status);
    const drafts = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(articles)
      .where(eq(articles.workflow, "draft"));
    const pending = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(comments)
      .where(eq(comments.status, "flagged_pending"));
    const day = bangkokDay();
    const [today] = await db
      .select({
        title: dailyAssignments.title,
        questions: sql<number>`jsonb_array_length(${dailyAssignments.questions})::int`,
      })
      .from(dailyAssignments)
      .where(eq(dailyAssignments.date, day));
    // Flagged in the current ranking, still in the reference group, and no
    // admin decision on record yet (STAT-06: a flag excludes nobody by itself).
    const [flags] = await db.execute<{ n: number }>(sql`
      select coalesce(sum((
        select count(*) from jsonb_array_elements(v.snapshot->'rows') r
        where jsonb_array_length(r->'flags') > 0
          and (r->>'reference')::boolean
          and not exists (
            select 1 from ranking_decisions d
            where d.pack_id = v.pack_id and d.user_id = (r->>'userId')::uuid)
      )), 0)::int as n
      from ranking_configs c
      join ranking_versions v on v.id = c.current_version_id`);
    const fireToday = await db
      .select({ state: fireLedger.state, n: sql<number>`count(*)::int` })
      .from(fireLedger)
      .where(eq(fireLedger.date, day))
      .groupBy(fireLedger.state);
    const [waiting] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(fireSummary)
      .where(isNotNull(fireSummary.pendingDate));
    return {
      certificateQueue: jobs,
      drafts: drafts[0]?.n ?? 0,
      pendingComments: pending[0]?.n ?? 0,
      pendingFlags: flags?.n ?? 0,
      dailyTitle: today?.title ?? "รอระบบเลือกโจทย์",
      fire: {
        date: day,
        questions: today?.questions ?? null,
        today: fireToday,
        pendingRecovery: waiting?.n ?? 0,
      },
    };
  });
