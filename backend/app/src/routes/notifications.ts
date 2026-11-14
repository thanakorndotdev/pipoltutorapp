import { Elysia, t } from "elysia";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { currentUser } from "../auth";
import { db } from "../db";
import { notifications } from "../db/schema";

/** In-site notifications. A dismissed one never pops up again (CMS-07, CERT-05). */
export const notificationsRoutes = new Elysia({ prefix: "/notifications" })
  // Default: what still has to pop up. `?all=1`: the dashboard list, closed ones included.
  .get("/", async ({ headers, set, query }) => {
    const user = await currentUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบ" };
    }
    const all = query.all === "1";
    return {
      notifications: await db
        .select({ id: notifications.id, kind: notifications.kind, title: notifications.title, body: notifications.body, link: notifications.link, createdAt: notifications.createdAt, dismissedAt: notifications.dismissedAt })
        .from(notifications)
        .where(all ? eq(notifications.userId, user.id) : and(eq(notifications.userId, user.id), isNull(notifications.dismissedAt)))
        .orderBy(desc(notifications.createdAt))
        .limit(all ? 30 : 20),
    };
  }, { query: t.Object({ all: t.Optional(t.Union([t.Literal("0"), t.Literal("1")])) }) })
  .post(
    "/:id/dismiss",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const [notice] = await db
        .update(notifications)
        .set({ dismissedAt: sql`coalesce(${notifications.dismissedAt}, now())` })
        .where(and(eq(notifications.id, params.id), eq(notifications.userId, user.id)))
        .returning({ id: notifications.id });
      if (!notice) {
        set.status = 404;
        return { error: "ไม่พบการแจ้งเตือน" };
      }
      return { ok: true };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  );
