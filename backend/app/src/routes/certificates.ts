import { readRanking } from "../features/ranking";
import { featureSettings } from "../db/features";
import { hash, lock } from "../features/common";
import { Elysia, t } from "elysia";
import { and, desc, eq, lte, ne } from "drizzle-orm";

import { currentUser } from "../auth";
import { permitted } from "../permissions";
import {
  certFile,
  reconcileAttempt,
  requeue,
  serialOf,
} from "../certificates/issue";
import { verifyManifest } from "../certificates/keys";
import { kickCertificateWorker } from "../certificates/worker";
import { db } from "../db";
import {
  attempts,
  certificates,
  certSigningKeys,
  examPacks,
} from "../db/schema";
import { gradeAttempt } from "../grading";

/**
 * Student side of certificates plus the public verify endpoints.
 * Ownership is always checked against the session user; a certificate id or
 * public id alone never opens scores or files (CERT-09, AC-01).
 */

const publicStatus = (s: (typeof certificates.status.enumValues)[number]) =>
  s === "queued" || s === "render_failed" ? "pending" : s;

/** Selected-attempt order shared with ranking (CERT-03, STAT-03): score, then less time, then earlier start. */
function better(
  a: { score: number | null; seconds: number; startedAt: Date },
  b: { score: number | null; seconds: number; startedAt: Date },
) {
  if ((a.score ?? -1) !== (b.score ?? -1))
    return (a.score ?? -1) > (b.score ?? -1);
  if (a.seconds !== b.seconds) return a.seconds < b.seconds;
  return a.startedAt.getTime() < b.startedAt.getTime();
}

export const certificatesRoutes = new Elysia({ prefix: "/certificates" })
  /**
   * Every certificate revision of the caller, newest first, one live row per
   * attempt. `isDefault` marks the attempt the dashboard opens first for each pack.
   */
  .get("/", async ({ headers, set }) => {
    const user = await currentUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบ" };
    }
    // Same clock rule as GET /attempts, then make sure every finished attempt has what it is owed.
    const stale = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, user.id),
          eq(attempts.status, "in_progress"),
          lte(attempts.expiresAt, new Date()),
        ),
      );
    for (const s of stale) await gradeAttempt(s.id, "expired");
    const finished = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(
        and(eq(attempts.userId, user.id), ne(attempts.status, "in_progress")),
      );
    let queued = false;
    for (const a of finished)
      queued = Boolean(await reconcileAttempt(a.id)) || queued;
    if (queued) void kickCertificateWorker();

    const rows = await db
      .select({
        id: certificates.id,
        publicId: certificates.publicId,
        serialNo: certificates.serialNo,
        status: certificates.status,
        revision: certificates.revision,
        recipientName: certificates.recipientName,
        issuedAt: certificates.issuedAt,
        attemptId: certificates.attemptId,
        packId: certificates.packId,
        packTitle: examPacks.title,
        packSlug: examPacks.slug,
        attemptNo: attempts.attemptNo,
        score: attempts.score,
        maxScore: attempts.maxScore,
        startedAt: attempts.startedAt,
        submittedAt: attempts.submittedAt,
      })
      .from(certificates)
      .innerJoin(examPacks, eq(examPacks.id, certificates.packId))
      .innerJoin(attempts, eq(attempts.id, certificates.attemptId))
      .where(eq(certificates.userId, user.id))
      .orderBy(desc(certificates.createdAt))
      .limit(500);

    const best = new Map<string, (typeof rows)[number]>();
    const key = (r: (typeof rows)[number]) => ({
      score: r.score,
      seconds:
        ((r.submittedAt ?? r.startedAt).getTime() - r.startedAt.getTime()) /
        1000,
      startedAt: r.startedAt,
    });
    for (const r of rows) {
      if (
        r.status !== "valid" &&
        r.status !== "queued" &&
        r.status !== "render_failed"
      )
        continue;
      const kept = best.get(r.packId);
      if (!kept || better(key(r), key(kept))) best.set(r.packId, r);
    }
    const snapshots = new Map(
      await Promise.all(
        [...new Set(rows.map((r) => r.packId))].map(
          async (id) => [id, (await readRanking(id)).snapshot] as const,
        ),
      ),
    );
    return {
      certificates: rows.map(({ serialNo, startedAt: _s, ...r }) => ({
        ...r,
        score: snapshots.get(r.packId)?.visibility.includes("score")
          ? (snapshots
              .get(r.packId)
              ?.rows.find((x) => x.attemptId === r.attemptId)?.official.score ??
            null)
          : null,
        serial: serialOf(serialNo),
        status: publicStatus(r.status),
        isDefault: best.get(r.packId)?.id === r.id,
      })),
    };
  })
  /**
   * The rendered file. Owner (or an admin) only; a certificate still in the
   * queue answers 409 so the page can say "กำลังสร้าง" instead of pretending.
   */
  .get(
    "/:id/file",
    async ({ params, query, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const [cert] = await db
        .select({
          id: certificates.id,
          userId: certificates.userId,
          status: certificates.status,
          serialNo: certificates.serialNo,
        })
        .from(certificates)
        .where(eq(certificates.id, params.id))
        .limit(1);
      if (!cert || (cert.userId !== user.id && !permitted(user,"certificate","read"))) {
        set.status = 404;
        return { error: "ไม่พบเกียรติบัตร" };
      }
      if (cert.status === "queued" || cert.status === "render_failed") {
        set.status = 409;
        return {
          error: "กำลังสร้างเกียรติบัตร ลองใหม่อีกครั้งในอีกสักครู่",
          code: "pending",
        };
      }
      if (cert.status === "revoked" || cert.status === "superseded") {
        set.status = 410;
        return {
          error:
            "เกียรติบัตรฉบับนี้ถูกเพิกถอนแล้ว กรุณาเข้าสู่ Dashboard เพื่อดาวน์โหลดฉบับล่าสุด",
          code: "revoked",
        };
      }
      const format = query.format === "pdf" ? "pdf" : "png";
      const file = Bun.file(certFile(cert.id, format));
      if (!(await file.exists())) {
        // The file store lost it; the row is intact, so draw it again under the same id.
        if (cert.status === "valid") {
          await db
            .update(certificates)
            .set({ status: "render_failed" })
            .where(eq(certificates.id, cert.id));
          await requeue(cert.id);
          void kickCertificateWorker();
        }
        set.status = 409;
        return {
          error: "กำลังสร้างเกียรติบัตร ลองใหม่อีกครั้งในอีกสักครู่",
          code: "pending",
        };
      }
      set.headers["content-type"] =
        format === "pdf" ? "application/pdf" : "image/png";
      set.headers["cache-control"] = "private, no-store";
      set.headers["x-content-type-options"] = "nosniff";
      if (query.download)
        set.headers["content-disposition"] =
          `attachment; filename="certificate-${serialOf(cert.serialNo)}.${format}"`;
      return file;
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      query: t.Object({
        format: t.Optional(t.String({ maxLength: 4 })),
        download: t.Optional(t.String({ maxLength: 4 })),
      }),
    },
  );

/** Name checks per client and certificate; the public endpoint must not be a name-guessing oracle (CERT-10). */
const NAME_CHECKS_PER_MINUTE = 8;
async function allowNameCheck(client: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const key = `rate.name.${hash(client)}.${Math.floor(Date.now() / 60000)}`;
    await lock(tx, key);
    const [row] = await tx
      .select()
      .from(featureSettings)
      .where(eq(featureSettings.key, key));
    const n = typeof row?.value === "number" ? row.value + 1 : 1;
    await tx
      .insert(featureSettings)
      .values({ key, value: n })
      .onConflictDoUpdate({
        target: featureSettings.key,
        set: { value: n, updatedAt: new Date() },
      });
    return n <= NAME_CHECKS_PER_MINUTE;
  });
}

/** Unicode-normalised, single-spaced, case-folded; honorifics are not stripped, the name must match as printed. */
const normaliseName = (s: string) =>
  s.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("th");

const publicIdParam = t.Object({
  publicId: t.String({
    minLength: 8,
    maxLength: 40,
    pattern: "^[A-Za-z0-9_-]+$",
  }),
});

async function findPublic(publicId: string) {
  const [row] = await db
    .select({
      cert: certificates,
      title: examPacks.title,
      level: examPacks.level,
      subject: examPacks.subjectLabel,
    })
    .from(certificates)
    .innerJoin(examPacks, eq(examPacks.id, certificates.packId))
    .where(eq(certificates.publicId, publicId))
    .limit(1);
  return row ?? null;
}

export const certVerifyRoutes = new Elysia({ prefix: "/cert" })
  /** Public keys, so a third party can check a manifest signature independently. */
  .get("/keys", async () => ({
    keys: await db
      .select({
        keyId: certSigningKeys.keyId,
        algorithm: certSigningKeys.algorithm,
        publicKeyPem: certSigningKeys.publicKeyPem,
        active: certSigningKeys.active,
        createdAt: certSigningKeys.createdAt,
      })
      .from(certSigningKeys)
      .orderBy(desc(certSigningKeys.createdAt)),
  }))
  /**
   * Public verification (CERT-09, 11). Says whether the certificate is real
   * and current — never the recipient's name, email or score.
   */
  .get(
    "/:publicId",
    async ({ params, set }) => {
      const row = await findPublic(params.publicId);
      if (!row) {
        set.status = 404;
        return { status: "not_found" as const };
      }
      const { cert } = row;
      const signatureValid =
        cert.manifest && cert.signature
          ? await verifyManifest(cert.manifest, cert.signature)
          : false;
      // When this one was replaced, say whether a current revision exists, without linking to it.
      let hasCurrent = false;
      if (
        cert.status === "revoked" ||
        cert.status === "superseded" ||
        cert.status === "previous_valid"
      ) {
        const [cur] = await db
          .select({ id: certificates.id })
          .from(certificates)
          .where(
            and(
              eq(certificates.attemptId, cert.attemptId),
              eq(certificates.status, "valid"),
            ),
          )
          .limit(1);
        hasCurrent = Boolean(cur);
      }
      return {
        status: publicStatus(cert.status),
        serial: serialOf(cert.serialNo),
        examTitle: row.title,
        level: row.level,
        subject: row.subject,
        issuedAt: cert.issuedAt,
        revision: cert.revision,
        signatureValid,
        keyId: cert.keyId,
        hasCurrent,
      };
    },
    { params: publicIdParam },
  )
  /**
   * CERT-10: the checker types the first name, the surname, or both as
   * printed; the answer is only match / no match.
   */
  .post(
    "/:publicId/verify-name",
    async ({ params, body, headers, set }) => {
      const client =
        headers["x-forwarded-for"]?.split(",")[0]?.trim() || "direct";
      if (!(await allowNameCheck(`${client}|${params.publicId}`))) {
        set.status = 429;
        return { error: "ตรวจสอบบ่อยเกินไป กรุณารอ 1 นาทีแล้วลองใหม่" };
      }
      const row = await findPublic(params.publicId);
      if (!row) {
        set.status = 404;
        return { status: "not_found" as const };
      }
      const given = normaliseName(body.name);
      const full = normaliseName(row.cert.recipientName);
      const [first, ...rest] = full.split(" ");
      const match =
        given.length > 0 &&
        (given === full ||
          given === first ||
          (rest.length > 0 && given === rest.join(" ")));
      return { match };
    },
    {
      params: publicIdParam,
      body: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
    },
  )
  /** "ดูผลสอบของฉัน": only the Google account that sat the attempt gets the attempt id back. */
  .get(
    "/:publicId/mine",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const row = await findPublic(params.publicId);
      if (!row || row.cert.userId !== user.id) {
        set.status = 404;
        return {
          error: "ไม่มีสิทธิ์เข้าถึงข้อมูลผลสอบนี้ กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่ใช้ทำข้อสอบ",
        };
      }
      return { attemptId: row.cert.attemptId, certificateId: row.cert.id };
    },
    { params: publicIdParam },
  );
