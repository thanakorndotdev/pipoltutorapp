import { audit } from "../audit";
import { reissueForRename } from "../certificates/issue";
import { kickCertificateWorker } from "../certificates/worker";
import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { currentUser } from "../auth";
import { PCSHS_CAMPUS_CODES } from "../campuses";
import { db } from "../db";
import { users } from "../db/schema";
import { profileComplete } from "../sessions";

const name = (max: number) => t.String({ minLength: 1, maxLength: max });

/**
 * The student profile asked for once after the first Google login and
 * editable afterwards. Email comes from the Google account and is not
 * editable here. Attempts snapshot these fields at start, so an edit never
 * rewrites the name or campus on past attempts.
 */
export const profileRoutes = new Elysia({ prefix: "/profile" })
  .get("/", async ({ headers, set }) => {
    const user = await currentUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบ" };
    }
    const { firstName, lastName, nickname, campus, email } = user;
    return { profile: { firstName, lastName, nickname, campus, email, complete: profileComplete(user) } };
  })
  .put(
    "/",
    async ({ headers, body, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const patch = {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        nickname: body.nickname.trim(),
        campus: body.campus,
      };
      if (!patch.firstName || !patch.lastName || !patch.nickname) {
        set.status = 422;
        return { error: "กรอกชื่อ นามสกุล และชื่อเล่นให้ครบ" };
      }
      const [row] = await db
        .update(users)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning({ firstName: users.firstName, lastName: users.lastName, nickname: users.nickname, campus: users.campus, email: users.email });
      if (!row) {
        set.status = 404;
        return { error: "ไม่พบผู้ใช้" };
      }
      // CERT-05: a new name revokes every certificate printed with the old one and queues replacements.
      let certificatesReissued = 0;
      if (patch.firstName !== (user.firstName ?? "") || patch.lastName !== (user.lastName ?? "")) {
        certificatesReissued = await reissueForRename(user.id);
        if (certificatesReissued > 0) {
          await audit({ id: user.id, kind: "user" }, { action: "certificate.reissue_rename", module: "certificate", targetId: user.id, after: { count: certificatesReissued } });
          void kickCertificateWorker();
        }
      }
      return { profile: { ...row, complete: profileComplete(row) }, certificatesReissued };
    },
    {
      body: t.Object({
        firstName: name(80),
        lastName: name(80),
        nickname: name(40),
        campus: t.UnionEnum(PCSHS_CAMPUS_CODES),
      }),
    }
  );
