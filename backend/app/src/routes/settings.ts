import { Elysia, t } from "elysia";

import { currentUser, hasAdminKey, isAdmin } from "../auth";
import {
  getExamSettings,
  publicExamSettings,
  updateExamSettings,
} from "../exam-settings";

const patchBody = t.Object({
  /** ISO 8601 with offset, e.g. "2026-01-25T00:00:00+07:00". */
  examDate: t.Optional(t.String({ format: "date-time" })),
  examVenueLabel: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
  enrollCloseAt: t.Optional(t.String({ format: "date-time" })),
  urgentDays: t.Optional(t.Integer({ minimum: 0, maximum: 365 })),
  /** 100 = the pack's own time, 150 = 1.5×. */
  timeMultiplierPercent: t.Optional(t.Integer({ minimum: 100, maximum: 400 })),
});

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .get("/exam", async () => publicExamSettings(await getExamSettings()))
  /** Lets the admin page confirm a key without writing anything. */
  .get("/admin/verify", async ({ headers, set }) => {
    if (hasAdminKey(headers)) return { ok: true, via: "key", user: null };
    const user = await currentUser(headers);
    if (isAdmin(user)) return { ok: true, via: "session", user };
    if (user) {
      // Signed in with Google but not an admin/dev: tell the gate which account to promote.
      set.status = 403;
      return { ok: false, error: `บัญชี ${user.email} ยังไม่มีสิทธิ์ผู้ดูแลระบบ` };
    }
    set.status = 401;
    return { ok: false, error: "API key ไม่ถูกต้อง" };
  })
  .put(
    "/exam",
    async ({ body, headers, set }) => {
      // Either the static admin key or an allow-listed session user.
      if (!hasAdminKey(headers)) {
        const user = await currentUser(headers);
        if (!user) {
          set.status = 401;
          return { error: "ต้องใส่ API key ผู้ดูแลระบบ หรือเข้าสู่ระบบก่อน" };
        }
        if (!isAdmin(user)) {
          set.status = 403;
          return { error: "เฉพาะผู้ดูแลระบบเท่านั้น" };
        }
      }

      const current = await getExamSettings();
      const examDate = body.examDate ? new Date(body.examDate) : undefined;
      const enrollCloseAt = body.enrollCloseAt
        ? new Date(body.enrollCloseAt)
        : undefined;
      // Validate the merged result, not just the fields in this request.
      if ((enrollCloseAt ?? current.enrollCloseAt) > (examDate ?? current.examDate)) {
        set.status = 422;
        return { error: "วันปิดรับสมัครต้องไม่เกินวันสอบ" };
      }

      const row = await updateExamSettings({
        examDate,
        enrollCloseAt,
        examVenueLabel: body.examVenueLabel?.trim(),
        urgentDays: body.urgentDays,
        timeMultiplierPercent: body.timeMultiplierPercent,
      });
      return publicExamSettings(row);
    },
    { body: patchBody }
  );
