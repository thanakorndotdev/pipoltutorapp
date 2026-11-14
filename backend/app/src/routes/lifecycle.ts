import { randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { attempts, certificates, sessions, users } from "../db/schema";
import { comments, deletionConsents } from "../db/features";
import { currentUser } from "../auth";
import { auditTx, fail, lock } from "../features/common";
import { staffRole } from "../permissions";
import { ownRanking } from "../features/ranking";
import { removeProfilePhoto } from "../profile-photo";
export const lifecycleRoutes = new Elysia()
  .get(
    "/attempts/:id/ranking",
    async ({ params, headers }) => {
      const u = await currentUser(headers);
      if (!u) fail("กรุณาเข้าสู่ระบบ", 401);
      return ownRanking(params.id, u!.id);
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) },
  )
  .post(
    "/profile/delete",
    async ({ headers, body, set }) => {
      const u = await currentUser(headers);
      if (!u) fail("กรุณาเข้าสู่ระบบ", 401);
      const [photoRow] = await db.select({ photoUrl: users.photoUrl }).from(users).where(eq(users.id, u!.id));
      const photoToRemove = photoRow?.photoUrl ?? null;
      await db.transaction(async (tx) => {
        await lock(tx, `account:${u!.id}`);
        if (staffRole(u!) === "owner") {
          const owners = await tx
            .select()
            .from(users)
            .where(eq(users.staffRole, "owner"));
          if (owners.filter((o) => o.id !== u!.id).length === 0)
            fail("เพิ่ม Owner สำรองก่อนลบบัญชี Owner คนสุดท้าย", 409);
        }
        await tx
          .insert(deletionConsents)
          .values({
            userId: u!.id,
            certificatePolicy: body.certificatePolicy,
            noticeVersion: "2026-11-13",
          });
        if (body.certificatePolicy === "revoke")
          await tx
            .update(certificates)
            .set({
              status: "revoked",
              recipientName: "ผู้ใช้ที่ลบบัญชี",
              revokedAt: new Date(),
              revokeReason: "account_deleted",
              manifest: null,
              signature: null,
              manifestHash: null,
            })
            .where(eq(certificates.userId, u!.id));
        await tx
          .update(attempts)
          .set({
            studentFirstName: null,
            studentLastName: null,
            studentNickname: null,
            studentCampus: null,
            studentEmail: null,
          })
          .where(eq(attempts.userId, u!.id));
        await tx
          .update(comments)
          .set({ status: "deleted", text: "ความคิดเห็นถูกลบตามคำขอเจ้าของบัญชี" })
          .where(eq(comments.userId, u!.id));
        await tx.delete(sessions).where(eq(sessions.userId, u!.id));
        await tx
          .update(users)
          .set({
            googleId: `deleted:${randomUUID()}`,
            email: `deleted-${u!.id}@deleted.invalid`,
            displayName: null,
            firstName: null,
            lastName: null,
            nickname: null,
            campus: null,
            avatarUrl: null,
            bio: null,
            photoUrl: null,
            deletedAt: new Date(),
            staffRole: "none",
            modulePermissions: {},
          })
          .where(eq(users.id, u!.id));
        await auditTx(
          tx,
          { id: u!.id, kind: "user" },
          {
            action: "account.delete",
            module: "users",
            targetId: u!.id,
            after: {
              certificatePolicy: body.certificatePolicy,
              noticeVersion: "2026-11-13",
            },
            reason: "คำขอลบบัญชีและความยินยอมของเจ้าของบัญชี",
          },
        );
      });
      await removeProfilePhoto(photoToRemove);
      set.headers["set-cookie"] =
        "pt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
      return { deleted: true };
    },
    {
      body: t.Object({
        certificatePolicy: t.Union([t.Literal("keep"), t.Literal("revoke")]),
        consent: t.Literal(true),
        confirmation: t.Literal("ลบบัญชีของฉัน"),
      }),
    },
  );
