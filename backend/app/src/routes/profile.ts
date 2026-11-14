import { audit } from "../audit";
import { reissueForRename } from "../certificates/issue";
import { kickCertificateWorker } from "../certificates/worker";
import { Elysia, t } from "elysia";
import { and, count, eq, isNull, sql } from "drizzle-orm";

import { currentUser } from "../auth";
import { PCSHS_CAMPUS_CODES } from "../campuses";
import { db } from "../db";
import { certificates, users } from "../db/schema";
import { fireSummary } from "../db/features";
import { PHOTO_MAX_BYTES, PhotoError, removeProfilePhoto, storeProfilePhoto } from "../profile-photo";
import { profileComplete } from "../sessions";

const name = (max: number) => t.String({ minLength: 1, maxLength: max });

export const BIO_MAX = 300;
/** Trim, drop control characters except newlines, and cap blank lines and length. */
export function cleanBio(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, BIO_MAX);
}

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
    const [extra] = await db.select({ bio: users.bio, photoUrl: users.photoUrl, createdAt: users.createdAt }).from(users).where(eq(users.id, user.id));
    return {
      profile: {
        id: user.id, firstName, lastName, nickname, campus, email, complete: profileComplete(user),
        bio: extra?.bio ?? null, photoUrl: extra?.photoUrl ?? null, avatarUrl: user.avatarUrl, joinedAt: extra?.createdAt ?? null,
      },
    };
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
  )
  /** Social-style "about me". Plain text only; rendered escaped. */
  .put(
    "/about",
    async ({ headers, body, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const bio = cleanBio(body.bio);
      await db.update(users).set({ bio: bio || null, updatedAt: new Date() }).where(eq(users.id, user.id));
      return { bio: bio || null };
    },
    { body: t.Object({ bio: t.String({ maxLength: BIO_MAX * 2 }) }) }
  )
  .post(
    "/photo",
    async ({ headers, body, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      let url: string;
      try {
        url = await storeProfilePhoto(body.file);
      } catch (error) {
        if (error instanceof PhotoError) {
          set.status = error.status;
          return { error: error.message };
        }
        throw error;
      }
      const [before] = await db.select({ photoUrl: users.photoUrl }).from(users).where(eq(users.id, user.id));
      await db.update(users).set({ photoUrl: url, updatedAt: new Date() }).where(eq(users.id, user.id));
      await removeProfilePhoto(before?.photoUrl);
      return { photoUrl: url };
    },
    { body: t.Object({ file: t.File({ maxSize: PHOTO_MAX_BYTES }) }) }
  )
  /** Back to the Google avatar. */
  .delete("/photo", async ({ headers, set }) => {
    const user = await currentUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบ" };
    }
    const [before] = await db.select({ photoUrl: users.photoUrl }).from(users).where(eq(users.id, user.id));
    await db.update(users).set({ photoUrl: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    await removeProfilePhoto(before?.photoUrl);
    return { photoUrl: null };
  });

/**
 * Another student's profile card. Signed-in visitors only, because profiles
 * belong to minors; shows the nickname, never the legal name, email, school
 * choice or any score (STAT-14).
 */
export const profilesRoutes = new Elysia({ prefix: "/profiles" }).get(
  "/:id",
  async ({ headers, params, set }) => {
    const viewer = await currentUser(headers);
    if (!viewer) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์" };
    }
    const [u] = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        bio: users.bio,
        photo: sql<string | null>`coalesce(${users.photoUrl}, ${users.avatarUrl})`,
        joinedAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, params.id), isNull(users.deletedAt)));
    if (!u) {
      set.status = 404;
      return { error: "ไม่พบโปรไฟล์" };
    }
    const [fire] = await db.select({ current: fireSummary.current, highest: fireSummary.highest }).from(fireSummary).where(eq(fireSummary.userId, u.id));
    const [certs] = await db
      .select({ n: count() })
      .from(certificates)
      .where(and(eq(certificates.userId, u.id), eq(certificates.status, "valid")));
    return {
      profile: {
        id: u.id,
        name: u.nickname ?? "นักเรียน",
        bio: u.bio,
        photo: u.photo,
        joinedAt: u.joinedAt,
        highestFire: fire?.highest ?? 0,
        certificates: certs?.n ?? 0,
        isMe: viewer.id === u.id,
      },
    };
  },
  { params: t.Object({ id: t.String({ format: "uuid" }) }) }
);

