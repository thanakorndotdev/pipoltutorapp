import { mkdir } from "node:fs/promises";

import { and, asc, eq, lte, sql } from "drizzle-orm";

import { db } from "../db";
import { attempts, certificateJobs, certificates, certTemplateVersions, examPacks, siteAssets, siteTexts, type CertLayout, type CertManifest } from "../db/schema";
import { publicUrl } from "../sessions";
import { SITE_TEXT_DEFAULTS } from "../site-texts";
import { CERT_FILES_DIR, certFile, serialOf } from "./issue";
import { readRanking } from "../features/ranking";
import { activeKeyId, manifestHash, signManifest } from "./keys";
import { DEFAULT_LAYOUT, type CertData } from "./layout";
import { pngToPdf, renderPng } from "./render";

/**
 * Render queue worker (CERT-07). Runs inside the API process: claims one
 * pending job at a time with SKIP LOCKED (so a second instance would not
 * double-render), signs the manifest, writes the PNG and PDF, then marks the
 * certificate valid. A failure pushes the job back with exponential backoff;
 * the certificate id never changes across retries.
 */
const MAX_TRIES = 8;
const backoffMs = (tries: number) => Math.min(5_000 * 2 ** tries, 10 * 60_000);

const LEVEL_LABEL: Record<string, string> = { m1: "ระดับชั้น ม.1", m4: "ระดับชั้น ม.4" };
const pts = (n: number | null) => (n === null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));
const thaiDate = new Intl.DateTimeFormat("th-TH", { calendar: "buddhist", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

/** Everything a render needs for one certificate, from the database only. */
export async function loadRenderContext(certificateId: string) {
  const [row] = await db
    .select({
      cert: certificates,
      title: examPacks.title,
      level: examPacks.level,
      subject: examPacks.subjectLabel,
      score: attempts.score,
      maxScore: attempts.maxScore,
      layout: certTemplateVersions.layout,
      templateId: certTemplateVersions.templateId,
      templateVersion: certTemplateVersions.version,
    })
    .from(certificates)
    .innerJoin(examPacks, eq(examPacks.id, certificates.packId))
    .innerJoin(attempts, eq(attempts.id, certificates.attemptId))
    .leftJoin(certTemplateVersions, eq(certTemplateVersions.id, certificates.templateVersionId))
    .where(eq(certificates.id, certificateId))
    .limit(1);
  if (!row) return null;
  const [issuer] = await db.select({ value: siteTexts.value }).from(siteTexts).where(eq(siteTexts.key, "brand.tutor_name")).limit(1);
  const [logo] = await db.select({ url: siteAssets.imageUrl }).from(siteAssets).where(eq(siteAssets.key, "logo")).limit(1);
  const percent = row.score !== null && row.maxScore ? Math.round((row.score / row.maxScore) * 100) : null;
  const result=await readRanking(row.cert.packId);
  const own=result.snapshot.rows.find(r=>r.userId===row.cert.userId);
  const data: CertData = {
    rank: result.snapshot.publishedFinal&&own?.official.rank?String(own.official.rank):"",
    recipient_full_name: row.cert.recipientName,
    grade: row.level ? (LEVEL_LABEL[row.level] ?? "") : "",
    subject: row.subject ?? "",
    exam_title: row.title,
    certificate_id: serialOf(row.cert.serialNo),
    issue_date: thaiDate.format(row.cert.issuedAt),
    issuer_name: issuer?.value ?? SITE_TEXT_DEFAULTS["brand.tutor_name"] ?? "pipoltutor",
    score: pts(row.score),
    max_score: pts(row.maxScore),
    percent: percent === null ? "" : `${percent}%`,
  };
  const layout: CertLayout = row.layout ?? DEFAULT_LAYOUT;
  return { row, data, layout, logoUrl: logo?.url ?? null, verifyUrl: `${publicUrl()}/cert/${row.cert.publicId}` };
}

async function renderJob(certificateId: string) {
  const ctx = await loadRenderContext(certificateId);
  if (!ctx) return;
  const { cert } = ctx.row;
  // Revoked while it waited: nothing to draw.
  if (cert.status !== "queued" && cert.status !== "render_failed") return;

  const manifest: CertManifest = {
    v: 1,
    issuer: new URL(publicUrl()).host,
    certificate_id: cert.publicId,
    serial: serialOf(cert.serialNo),
    attempt_id: cert.attemptId,
    recipient_name: cert.recipientName,
    exam: { pack_id: cert.packId, title: ctx.row.title, level: ctx.row.level, subject: ctx.row.subject },
    issued_at: cert.issuedAt.toISOString(),
    revision: cert.revision,
    template: { id: ctx.row.templateId ?? null, version: ctx.row.templateVersion ?? 0 },
    key_id: await activeKeyId(),
    dynamic_fields:ctx.data,
  };
  const signature = await signManifest(manifest);
  const child=Bun.spawn([process.execPath,"run",new URL("./render-process.ts",import.meta.url).pathname],{stdin:"pipe",stdout:"ignore",stderr:"pipe"});
  child.stdin.write(JSON.stringify({id:cert.id,render:{layout:ctx.layout,data:ctx.data,verifyUrl:ctx.verifyUrl,logoUrl:ctx.logoUrl},title:`เกียรติบัตร ${manifest.serial}`}));
  child.stdin.end();
  const [exitCode]=await Promise.all([child.exited,new Response(child.stderr).text()]);
  if(exitCode!==0)throw new Error("Certificate render process failed; storage or native renderer unavailable");
  await db
    .update(certificates)
    .set({ status: "valid", manifest, manifestHash: manifestHash(manifest), signature, keyId: manifest.key_id })
    .where(and(eq(certificates.id, cert.id), sql`${certificates.status} in ('queued', 'render_failed')`));
}

/** Claims and runs one due job. Returns false when the queue is empty. */
async function runOne(): Promise<boolean> {
  const job = await db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: certificateJobs.id, certificateId: certificateJobs.certificateId, tries: certificateJobs.tries })
      .from(certificateJobs)
      .where(and(eq(certificateJobs.status, "pending"), lte(certificateJobs.runAfter, new Date())))
      .orderBy(asc(certificateJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!next) return null;
    await tx.update(certificateJobs).set({ status: "running", updatedAt: new Date() }).where(eq(certificateJobs.id, next.id));
    return next;
  });
  if (!job) return false;
  try {
    await renderJob(job.certificateId);
    await db.update(certificateJobs).set({ status: "done", lastError: null, updatedAt: new Date() }).where(eq(certificateJobs.id, job.id));
  } catch (error) {
    const tries = job.tries + 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`certificate ${job.certificateId} render failed (try ${tries}):`, message);
    await db
      .update(certificateJobs)
      .set({ status: tries >= MAX_TRIES ? "failed" : "pending", tries, lastError: message.slice(0, 500), runAfter: new Date(Date.now() + backoffMs(tries)), updatedAt: new Date() })
      .where(eq(certificateJobs.id, job.id));
    await db.update(certificates).set({ status: "render_failed" }).where(and(eq(certificates.id, job.certificateId), eq(certificates.status, "queued")));
  }
  return true;
}

let draining = false;
/** Drains whatever is due now. Call after enqueueing so a student rarely waits for the next tick. */
export async function kickCertificateWorker() {
  if (draining) return;
  draining = true;
  try {
    while (await runOne());
  } catch (error) {
    console.error("certificate worker:", error instanceof Error ? error.message : String(error));
  } finally {
    draining = false;
  }
}

export function startCertificateWorker() {
  // Jobs left "running" by a crash go back to pending.
  void db
    .update(certificateJobs)
    .set({ status: "pending", updatedAt: new Date() })
    .where(and(eq(certificateJobs.status,"running"),lte(certificateJobs.updatedAt,new Date(Date.now()-600_000))))
    .then(() => kickCertificateWorker())
    .catch((error) => console.error("certificate worker start:", error instanceof Error ? error.message : String(error)));
  setInterval(() => void kickCertificateWorker(), 5_000);
}
