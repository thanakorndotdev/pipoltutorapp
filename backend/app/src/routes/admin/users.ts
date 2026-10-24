import { Elysia, t } from "elysia";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { currentUser, hasAdminKey } from "../../auth";
import { db } from "../../db";
import { USER_ROLES, attempts, examPacks, users } from "../../db/schema";
import { adminGuard } from "./guard";

const idParam = t.Object({ id: t.String({ format: "uuid" }) });

/** Public-safe user columns: never googleId (the OAuth subject). */
const userColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  role: users.role,
  firstName: users.firstName,
  lastName: users.lastName,
  nickname: users.nickname,
  campus: users.campus,
  createdAt: users.createdAt,
};

const PAGE_SIZE = 50;

export const adminUsersRoutes = new Elysia({ prefix: "/admin/users" })
  .use(adminGuard)

  /** Newest first, optional search on email / name. Roles first so admins are easy to audit. */
  .get(
    "/",
    async ({ query }) => {
      const q = query.q?.trim();
      const where = q
        ? or(
            ilike(users.email, `%${q}%`),
            ilike(users.displayName, `%${q}%`),
            ilike(users.firstName, `%${q}%`),
            ilike(users.lastName, `%${q}%`),
            ilike(users.nickname, `%${q}%`)
          )
        : undefined;
      const rows = await db
        .select(userColumns)
        .from(users)
        .where(where)
        .orderBy(sql`case ${users.role} when 'admin' then 0 when 'dev' then 1 when 'test' then 2 else 3 end`, desc(users.createdAt))
        .limit(PAGE_SIZE);
      const counts = await db.select({ role: users.role, n: sql<number>`count(*)::int` }).from(users).groupBy(users.role);
      return { users: rows, roles: USER_ROLES, counts: Object.fromEntries(counts.map((c) => [c.role, c.n])) };
    },
    { query: t.Object({ q: t.Optional(t.String({ maxLength: 120 })) }) }
  )

  /**
   * One student: current profile and every attempt on every pack, oldest
   * first so attempt numbers read in order. Each attempt keeps the profile
   * snapshot it started with.
   */
  .get(
    "/:id",
    async ({ params, set }) => {
      const [user] = await db.select(userColumns).from(users).where(eq(users.id, params.id)).limit(1);
      if (!user) {
        set.status = 404;
        return { error: "ไม่พบผู้ใช้" };
      }
      const rows = await db
        .select({
          id: attempts.id,
          userId: attempts.userId,
          packId: attempts.packId,
          packTitle: examPacks.title,
          packSlug: examPacks.slug,
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
        })
        .from(attempts)
        .innerJoin(examPacks, eq(examPacks.id, attempts.packId))
        .where(eq(attempts.userId, params.id))
        .orderBy(asc(attempts.startedAt));
      return { user, attempts: rows };
    },
    { params: idParam }
  )

  .patch(
    "/:id",
    async ({ params, body, headers, set }) => {
      // A session admin cannot demote themself and lock everyone out; the static key may.
      if (!hasAdminKey(headers)) {
        const me = await currentUser(headers);
        if (me && me.id === params.id && body.role !== "admin" && body.role !== "dev") {
          set.status = 409;
          return { error: "เปลี่ยนสิทธิ์ของตัวเองให้ต่ำกว่าผู้ดูแลไม่ได้" };
        }
      }
      const [row] = await db
        .update(users)
        .set({ role: body.role, updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning(userColumns);
      if (!row) {
        set.status = 404;
        return { error: "ไม่พบผู้ใช้" };
      }
      return { user: row };
    },
    { params: idParam, body: t.Object({ role: t.Union(USER_ROLES.map((r) => t.Literal(r))) }) }
  );
