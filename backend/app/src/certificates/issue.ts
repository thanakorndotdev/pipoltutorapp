import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import { attempts, certificateJobs, certificates, certTemplates, certTemplateVersions, examPacks, notifications, users } from "../db/schema";

/**
 * Issuing rules (CERT-01, 02, 05). A certificate row is created in status
 * "queued" with a render job; the worker signs and draws it. Everything here
 * is idempotent: the partial unique index allows one live revision per
 * attempt, so a repeated trigger finds the existing row.
 */
const CERT_DIR = resolve(process.env.CERT_DIR ?? join(process.cwd(), "certificates"));
export const certFile = (certificateId: string, ext: "png" | "pdf") => join(CERT_DIR, `${certificateId}.${ext}`);
export const CERT_FILES_DIR = CERT_DIR;

export const serialOf = (n: number | null) => `PT-${String(n ?? 0).padStart(6, "0")}`;

/** Statuses that count as "this attempt has a certificate in play". */
export const LIVE = ["queued", "valid", "render_failed"] as const;
const live = inArray(certificates.status, [...LIVE]);

type AttemptRow = { status: "in_progress" | "submitted" | "expired"; expiresAt: Date; resetAt: Date | null };
type PackRules = {
  certificateEnabled: boolean;
  certOnAutoSubmit: boolean;
  certOnHardCutoff: boolean;
  certOnReopen: boolean;
  closesAt: Date | null;
};

/** CERT-01: does this attempt earn a certificate under its pack's settings? Never for an attempt still running. */
export function eligible(attempt: AttemptRow, pack: PackRules): boolean {
  if (!pack.certificateEnabled || attempt.status === "in_progress") return false;
  if (attempt.resetAt && !pack.certOnReopen) return false;
  if (attempt.status === "expired") {
    const hardCutoff = pack.closesAt !== null && attempt.expiresAt.getTime() >= pack.closesAt.getTime();
    return hardCutoff ? pack.certOnHardCutoff : pack.certOnAutoSubmit;
  }
  return true;
}

const fullName = (first: string | null, last: string | null) => [first?.trim(), last?.trim()].filter(Boolean).join(" ");

async function currentTemplateVersion(templateId: string | null): Promise<string | null> {
  if (!templateId) return null;
  const [v] = await db
    .select({ id: certTemplateVersions.id })
    .from(certTemplateVersions)
    .innerJoin(certTemplates, eq(certTemplates.id, certTemplateVersions.templateId))
    .where(and(eq(certTemplateVersions.templateId, templateId), eq(certTemplateVersions.version, certTemplates.publishedVersion)))
    .limit(1);
  return v?.id ?? null;
}

async function enqueue(certificateId: string) {
  await db.insert(certificateJobs).values({ certificateId }).onConflictDoNothing({ target: certificateJobs.certificateId });
}

/**
 * Brings one attempt's certificate in line with the rules: issues when it is
 * eligible and has none, revokes when it has one and no longer qualifies
 * (e.g. the admin reset the attempt). Returns the live certificate id, or null.
 */
export async function reconcileAttempt(attemptId: string, force = false): Promise<string | null> {
  const [row] = await db
    .select({
      attempt: { id: attempts.id, userId: attempts.userId, packId: attempts.packId, status: attempts.status, expiresAt: attempts.expiresAt, resetAt: attempts.resetAt, first: attempts.studentFirstName, last: attempts.studentLastName },
      pack: { certificateEnabled: examPacks.certificateEnabled, certOnAutoSubmit: examPacks.certOnAutoSubmit, certOnHardCutoff: examPacks.certOnHardCutoff, certOnReopen: examPacks.certOnReopen, closesAt: examPacks.closesAt, certTemplateId: examPacks.certTemplateId },
      user: { first: users.firstName, last: users.lastName },
    })
    .from(attempts)
    .innerJoin(examPacks, eq(examPacks.id, attempts.packId))
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!row) return null;

  const [existing] = await db.select({ id: certificates.id }).from(certificates).where(and(eq(certificates.attemptId, attemptId), live)).limit(1);
  if (!eligible(row.attempt, row.pack)) {
    if (existing) await revoke([existing.id], "not_eligible");
    return null;
  }
  if (existing) return existing.id;

  // An admin's revocation stands: only an explicit admin reissue brings the attempt's certificate back.
  const [last] = await db
    .select({ reason: certificates.revokeReason, status: certificates.status })
    .from(certificates)
    .where(eq(certificates.attemptId, attemptId))
    .orderBy(desc(certificates.revision))
    .limit(1);
  if (!force && last?.status === "revoked" && last.reason === "admin") return null;

  // The name comes from the server's own profile data, never from the request (CERT-05).
  const recipientName = fullName(row.user.first, row.user.last) || fullName(row.attempt.first, row.attempt.last);
  if (!recipientName) return null;

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${certificates.revision}), 0) + 1` })
    .from(certificates)
    .where(eq(certificates.attemptId, attemptId));
  const [created] = await db
    .insert(certificates)
    .values({
      publicId: randomBytes(12).toString("base64url"),
      attemptId,
      userId: row.attempt.userId,
      packId: row.attempt.packId,
      revision: Number(next),
      recipientName,
      templateVersionId: await currentTemplateVersion(row.pack.certTemplateId),
    })
    .onConflictDoNothing({ target: certificates.attemptId, where: sql`${certificates.status} in ('queued', 'valid', 'render_failed')` })
    .returning({ id: certificates.id });
  if (!created) {
    // A concurrent trigger won the insert; hand back its row.
    const [winner] = await db.select({ id: certificates.id }).from(certificates).where(and(eq(certificates.attemptId, attemptId), live)).limit(1);
    return winner?.id ?? null;
  }
  await enqueue(created.id);
  return created.id;
}

/** Marks live certificates as no longer usable. `status` "previous_valid" keeps an old template version verifiable. */
export async function revoke(ids: string[], reason: string, status: "revoked" | "superseded" | "previous_valid" = "revoked") {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(certificates)
    .set({ status, revokedAt: status === "previous_valid" ? null : new Date(), revokeReason: reason })
    .where(and(inArray(certificates.id, ids), inArray(certificates.status, ["queued", "valid", "render_failed", "previous_valid"])))
    .returning({ id: certificates.id });
  return rows.length;
}

/** Every finished attempt of a pack, reconciled. Used when a pack's certificate settings change and for bulk issue. */
export async function reconcilePack(packId: string): Promise<{ checked: number; live: number }> {
  const rows = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.packId, packId));
  let n = 0;
  for (const r of rows) if (await reconcileAttempt(r.id)) n += 1;
  return { checked: rows.length, live: n };
}

/**
 * CERT-05: the student's name changed. Every live certificate is revoked and
 * a new revision (new public id) is queued in its place, then the student is
 * told once in-site. Safe to call again: nothing live means nothing to do.
 */
export async function reissueForRename(userId: string): Promise<number> {
  await db.update(certificates).set({status:"revoked",revokedAt:new Date(),revokeReason:"name_changed"}).where(and(eq(certificates.userId,userId),eq(certificates.status,"previous_valid")));
  const mine = await db.select({ id: certificates.id, attemptId: certificates.attemptId }).from(certificates).where(and(eq(certificates.userId, userId), live));
  if (mine.length === 0) return 0;
  await revoke(mine.map((c) => c.id), "name_changed");
  let issued = 0;
  for (const c of mine) if (await reconcileAttempt(c.attemptId)) issued += 1;
  if (issued > 0) {
    await db.insert(notifications).values({
      userId,
      kind: "certificate_reissued",
      title: "ชื่อบนเกียรติบัตรได้รับการอัปเดตแล้ว",
      body: "โปรดดาวน์โหลดเกียรติบัตรฉบับใหม่ ฉบับเดิมถูกเพิกถอนแล้ว",
      link: "/dashboard#certificates",
    });
  }
  return issued;
}

/**
 * 3.2: the pack's template changed after certificates went out. Valid
 * certificates get a new revision on the new template; the old ones stay
 * verifiable as "previous" or are superseded, as the admin chose.
 */
export async function reissueForTemplate(packId: string, oldPolicy: "previous_valid" | "superseded"): Promise<number> {
  const rows = await db.select({ id: certificates.id, attemptId: certificates.attemptId }).from(certificates).where(and(eq(certificates.packId, packId), live));
  await revoke(rows.map((c) => c.id), "template_changed", oldPolicy);
  let issued = 0;
  for (const c of rows) if (await reconcileAttempt(c.attemptId)) issued += 1;
  return issued;
}

/** How many live certificates a template change on this pack would touch (shown before confirming). */
export async function liveCount(packId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(certificates).where(and(eq(certificates.packId, packId), live));
  return Number(r?.n ?? 0);
}

/** Puts a failed or stuck certificate back in the queue. */
export async function requeue(certificateId: string) {
  await db
    .insert(certificateJobs)
    .values({ certificateId })
    .onConflictDoUpdate({ target: certificateJobs.certificateId, set: { status: "pending", tries: 0, lastError: null, runAfter: new Date(), updatedAt: new Date() } });
  await db.update(certificates).set({ status: "queued" }).where(and(eq(certificates.id, certificateId), eq(certificates.status, "render_failed")));
}

export const newestFirst = desc(certificates.createdAt);

/** Regrading changes a signed dynamic score/rank field, so replace only affected layouts. */
export async function reissueForScoreChange(packId:string) {
 const rows=await db.select({id:certificates.id,attemptId:certificates.attemptId,layout:certTemplateVersions.layout}).from(certificates).leftJoin(certTemplateVersions,eq(certTemplateVersions.id,certificates.templateVersionId)).where(and(eq(certificates.packId,packId),live));
 for(const c of rows){if(!c.layout?.elements.some(e=>e.type==="text"&&/\{(score|max_score|percent|rank)\}/.test(e.text)))continue;await revoke([c.id],"score_changed");await reconcileAttempt(c.attemptId);}
}
