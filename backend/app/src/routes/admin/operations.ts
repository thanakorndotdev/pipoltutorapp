import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, users } from "../../db/schema";
import { errorLogs, retentionPolicies } from "../../db/features";
import { actorOf } from "../../audit";
import { auditTx, fail, lock } from "../../features/common";
import { authorize, MODULES, ACTIONS, STAFF_ROLES } from "../../permissions";
import { PURGEABLE } from "../../features/retention";
import { adminGuard } from "./guard";
export const adminOperationsRoutes = new Elysia({ prefix: "/admin" })
  .use(adminGuard)
  .get(
    "/audit",
    async ({ query }) => ({
      logs: await db
        .select()
        .from(auditLogs)
        .where(
          and(
            query.module ? eq(auditLogs.module, query.module) : undefined,
            query.q ? ilike(auditLogs.action, `%${query.q}%`) : undefined,
          ),
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(100)
        .offset(Number(query.offset ?? 0)),
    }),
    {
      query: t.Object({
        module: t.Optional(t.String({ maxLength: 40 })),
        q: t.Optional(t.String({ maxLength: 100 })),
        offset: t.Optional(t.Numeric({ minimum: 0, maximum: 100000 })),
      }),
    },
  )
  .get("/errors", async () => ({
    errors: await db
      .select()
      .from(errorLogs)
      .orderBy(desc(errorLogs.createdAt))
      .limit(200),
  }))
  .get("/retention", async () => {
    for (const category of [
      "profile",
      "attempts",
      "result_revisions",
      "certificates",
      "comments",
      "learning_events",
      "technical_logs",
      "audit",
    ])
      await db
        .insert(retentionPolicies)
        .values({ category, days: category === "technical_logs" ? 30 : 365 })
        .onConflictDoNothing();
    return {
      policies: await db.select().from(retentionPolicies),
      // Only unlinked categories are purged automatically, and only after approval.
      automaticDeletion: Object.keys(PURGEABLE),
      automaticDeletionEnabled: true,
      notice:
        "ค่าที่เสนอรอ Owner อนุมัติก่อน deploy เมื่ออนุมัติแล้ว ระบบลบ technical logs และ learning events ที่เกินกำหนดอัตโนมัติ ส่วนข้อมูลที่เชื่อมโยงกัน (โปรไฟล์ ผลสอบ revision เกียรติบัตร ความคิดเห็น audit) ต้องผ่านแผน lifecycle",
    };
  })
  .put(
    "/retention/:category",
    async ({ params, body, headers }) => {
      await authorize(headers, "audit", "write", true);
      return db.transaction(async (tx) => {
        const actor = await actorOf(headers);
        const [p] = await tx
          .select()
          .from(retentionPolicies)
          .where(eq(retentionPolicies.category, params.category))
          .for("update");
        if (!p || p.version !== body.baseVersion)
          fail("ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่", 409);
        await tx
          .update(retentionPolicies)
          .set({
            days: body.days,
            approvedBy: actor.id,
            approvedAt: new Date(),
            version: p!.version + 1,
          })
          .where(eq(retentionPolicies.category, params.category));
        await auditTx(tx, actor, {
          module: "audit",
          action: "retention.approve",
          targetId: params.category,
          before: p,
          after: body,
          reason: body.reason,
        });
        return { ok: true };
      });
    },
    {
      params: t.Object({ category: t.String({ maxLength: 40 }) }),
      body: t.Object({
        days: t.Nullable(t.Integer({ minimum: 1, maximum: 3650 })),
        baseVersion: t.Integer({ minimum: 1 }),
        reason: t.String({ minLength: 3, maxLength: 500 }),
      }),
    },
  )
  .get("/users/permissions/templates", async () => ({
    modules: MODULES,
    actions: ACTIONS,
    roles: STAFF_ROLES,
  }))
  .put(
    "/users/:id/permissions",
    async ({ params, body, headers }) => {
      await authorize(headers, "users", "write", true);
      return db.transaction(async (tx) => {
        await lock(tx, "permissions");
        const actor = await actorOf(headers);
        const [u] = await tx
          .select()
          .from(users)
          .where(eq(users.id, params.id))
          .for("update");
        if (!u) fail("ไม่พบผู้ใช้", 404);
        if (body.staffRole !== "owner" && u!.staffRole === "owner") {
          const owners = await tx
            .select()
            .from(users)
            .where(eq(users.staffRole, "owner"));
          if (owners.length <= 1)
            fail("ต้องมี Owner สำรองก่อนถอด Owner คนสุดท้าย", 409);
        }
        await tx
          .update(users)
          .set({
            staffRole: body.staffRole,
            modulePermissions: body.modulePermissions,
            updatedAt: new Date(),
          })
          .where(eq(users.id, params.id));
        await auditTx(tx, actor, {
          action: "permissions.change",
          module: "users",
          targetId: params.id,
          before: {
            staffRole: u!.staffRole,
            modulePermissions: u!.modulePermissions,
          },
          after: body,
          reason: body.reason,
        });
        return { ok: true };
      });
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({
        staffRole: t.Union(STAFF_ROLES.map((r) => t.Literal(r))),
        modulePermissions: t.Record(
          t.String({
            pattern:
              "^(exam|certificate|ranking|article|comment|daily|audit|users|site)$",
          }),
          t.Array(t.String({ pattern: "^(read|write|publish|export)$" }), {
            uniqueItems: true,
          }),
          { additionalProperties: false },
        ),
        reason: t.String({ minLength: 3, maxLength: 500 }),
      }),
    },
  );
