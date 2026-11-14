import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { actorOf, audit } from "../../audit";
import { liveCount, reconcileAttempt, reconcilePack, reissueForTemplate, requeue, revoke, serialOf } from "../../certificates/issue";
import { rotateKey, verifyManifest } from "../../certificates/keys";
import { CERT_FIELDS, DEFAULT_LAYOUT, layoutProblems, type CertData } from "../../certificates/layout";
import { pngToPdf, renderPng } from "../../certificates/render";
import { kickCertificateWorker } from "../../certificates/worker";
import { db } from "../../db";
import { certificateJobs, certificates, certSigningKeys, certTemplates, certTemplateVersions, examPacks, users, type CertLayout } from "../../db/schema";
import { publicUrl } from "../../sessions";
import { adminGuard } from "./guard";

const idParam = t.Object({ id: t.String({ format: "uuid" }) });
const reasonBody = t.Object({ reason: t.String({ minLength: 3, maxLength: 500 }) });

const STATUSES = ["queued", "valid", "render_failed", "revoked", "previous_valid", "superseded"] as const;

export const adminCertificatesRoutes = new Elysia({ prefix: "/admin/certificates" })
  .use(adminGuard)
  /** Certificates with recipient and queue state; filter by pack, status, or a name / email / serial search. */
  .get(
    "/",
    async ({ query }) => {
      const q = query.q?.trim();
      const serial = q && /^(pt-)?\d+$/i.test(q) ? Number(q.replace(/\D/g, "")) : null;
      const rows = await db
        .select({
          id: certificates.id,
          publicId: certificates.publicId,
          serialNo: certificates.serialNo,
          status: certificates.status,
          revision: certificates.revision,
          recipientName: certificates.recipientName,
          issuedAt: certificates.issuedAt,
          revokedAt: certificates.revokedAt,
          revokeReason: certificates.revokeReason,
          attemptId: certificates.attemptId,
          packId: certificates.packId,
          packTitle: examPacks.title,
          email: users.email,
          jobStatus: certificateJobs.status,
          jobTries: certificateJobs.tries,
          jobError: certificateJobs.lastError,
        })
        .from(certificates)
        .innerJoin(examPacks, eq(examPacks.id, certificates.packId))
        .innerJoin(users, eq(users.id, certificates.userId))
        .leftJoin(certificateJobs, eq(certificateJobs.certificateId, certificates.id))
        .where(
          and(
            query.packId ? eq(certificates.packId, query.packId) : undefined,
            query.status ? eq(certificates.status, query.status) : undefined,
            q ? or(ilike(certificates.recipientName, `%${q}%`), ilike(users.email, `%${q}%`), serial !== null ? eq(certificates.serialNo, serial) : undefined) : undefined
          )
        )
        .orderBy(desc(certificates.createdAt))
        .limit(300);
      const [counts] = await db
        .select({
          queued: sql<number>`count(*) filter (where ${certificates.status} = 'queued')`,
          failed: sql<number>`count(*) filter (where ${certificates.status} = 'render_failed')`,
          valid: sql<number>`count(*) filter (where ${certificates.status} = 'valid')`,
        })
        .from(certificates);
      return {
        certificates: rows.map(({ serialNo, ...r }) => ({ ...r, serial: serialOf(serialNo) })),
        counts: { queued: Number(counts?.queued ?? 0), failed: Number(counts?.failed ?? 0), valid: Number(counts?.valid ?? 0) },
      };
    },
    {
      query: t.Object({
        packId: t.Optional(t.String({ format: "uuid" })),
        // Literal union, not UnionEnum: Elysia fills an absent optional enum with its first value.
        status: t.Optional(t.Union(STATUSES.map((s) => t.Literal(s)))),
        q: t.Optional(t.String({ maxLength: 200 })),
      }),
    }
  )
  /** One certificate with its signed manifest and a live signature check (verify lookup). */
  .get(
    "/:id",
    async ({ params, set }) => {
      const [cert] = await db.select().from(certificates).where(eq(certificates.id, params.id)).limit(1);
      if (!cert) {
        set.status = 404;
        return { error: "ไม่พบเกียรติบัตร" };
      }
      const signatureValid = cert.manifest && cert.signature ? await verifyManifest(cert.manifest, cert.signature) : false;
      return { certificate: { ...cert, serial: serialOf(cert.serialNo), signatureValid, verifyUrl: `${publicUrl()}/cert/${cert.publicId}` } };
    },
    { params: idParam }
  )
  .post(
    "/:id/revoke",
    async ({ params, body, headers, set }) => {
      const n = await revoke([params.id], "admin");
      if (n === 0) {
        set.status = 409;
        return { error: "เกียรติบัตรนี้ถูกเพิกถอนหรือถูกแทนที่ไปแล้ว" };
      }
      await audit(await actorOf(headers), { action: "certificate.revoke", module: "certificate", targetId: params.id, reason: body.reason });
      return { ok: true };
    },
    { params: idParam, body: reasonBody }
  )
  /** Issue again for the attempt of a certificate an admin revoked (new revision, new public id). */
  .post(
    "/:id/reissue",
    async ({ params, body, headers, set }) => {
      const [cert] = await db.select({ attemptId: certificates.attemptId }).from(certificates).where(eq(certificates.id, params.id)).limit(1);
      const issued = cert ? await reconcileAttempt(cert.attemptId, true) : null;
      if (!issued) {
        set.status = 409;
        return { error: "ออกใบใหม่ไม่ได้: การสอบครั้งนี้ไม่เข้าเงื่อนไขของชุดข้อสอบ หรือไม่พบเกียรติบัตร" };
      }
      await audit(await actorOf(headers), { action: "certificate.reissue", module: "certificate", targetId: issued, before: { from: params.id }, reason: body.reason });
      void kickCertificateWorker();
      return { certificateId: issued };
    },
    { params: idParam, body: reasonBody }
  )
  /** Put a failed render back in the queue under the same certificate id. */
  .post(
    "/:id/retry",
    async ({ params, headers }) => {
      await requeue(params.id);
      await audit(await actorOf(headers), { action: "certificate.retry", module: "certificate", targetId: params.id });
      void kickCertificateWorker();
      return { ok: true };
    },
    { params: idParam }
  )
  /** Every pack with its certificate settings and how many live certificates it has. */
  .get("/packs/list", async () => ({
    packs: await db
      .select({
        id: examPacks.id,
        title: examPacks.title,
        slug: examPacks.slug,
        level: examPacks.level,
        subjectLabel: examPacks.subjectLabel,
        certificateEnabled: examPacks.certificateEnabled,
        certOnAutoSubmit: examPacks.certOnAutoSubmit,
        certOnHardCutoff: examPacks.certOnHardCutoff,
        certOnReopen: examPacks.certOnReopen,
        certTemplateId: examPacks.certTemplateId,
        live: sql<number>`(select count(*)::int from certificates c where c.pack_id = exam_packs.id and c.status in ('queued', 'valid', 'render_failed'))`,
      })
      .from(examPacks)
      .orderBy(examPacks.title),
    templates: await db.select({ id: certTemplates.id, name: certTemplates.name, publishedVersion: certTemplates.publishedVersion }).from(certTemplates).orderBy(certTemplates.name),
  }))
  /**
   * CERT-01 settings of one pack. Changing who qualifies issues what is now
   * owed and revokes what no longer qualifies; changing only the template
   * affects new certificates until the admin reissues the pack.
   */
  .put(
    "/packs/:id/settings",
    async ({ params, body, headers, set }) => {
      if (body.certTemplateId) {
        const [tpl] = await db.select({ v: certTemplates.publishedVersion }).from(certTemplates).where(eq(certTemplates.id, body.certTemplateId)).limit(1);
        if (!tpl || tpl.v === 0) {
          set.status = 422;
          return { error: "เทมเพลตนี้ยังไม่ได้เผยแพร่ กดเผยแพร่ในหน้าเทมเพลตก่อน" };
        }
      }
      const cols = {
        level: examPacks.level,
        subjectLabel: examPacks.subjectLabel,
        certificateEnabled: examPacks.certificateEnabled,
        certOnAutoSubmit: examPacks.certOnAutoSubmit,
        certOnHardCutoff: examPacks.certOnHardCutoff,
        certOnReopen: examPacks.certOnReopen,
        certTemplateId: examPacks.certTemplateId,
      };
      const [before] = await db.select(cols).from(examPacks).where(eq(examPacks.id, params.id)).limit(1);
      if (!before) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      const after = { ...body, subjectLabel: body.subjectLabel?.trim() || null };
      await db.update(examPacks).set(after).where(eq(examPacks.id, params.id));
      const result = await reconcilePack(params.id);
      await audit(await actorOf(headers), { action: "pack.certificate_rules", module: "certificate", targetId: params.id, before, after: { ...after, ...result } });
      void kickCertificateWorker();
      return { settings: after, ...result };
    },
    {
      params: idParam,
      body: t.Object({
        level: t.Union([t.Literal("m1"), t.Literal("m4"), t.Null()]),
        subjectLabel: t.Union([t.String({ maxLength: 120 }), t.Null()]),
        certificateEnabled: t.Boolean(),
        certOnAutoSubmit: t.Boolean(),
        certOnHardCutoff: t.Boolean(),
        certOnReopen: t.Boolean(),
        certTemplateId: t.Union([t.String({ format: "uuid" }), t.Null()]),
      }),
    }
  )
  /** Bulk issue: every finished attempt of the pack gets what its rules owe it. Safe to repeat. */
  .post(
    "/packs/:id/issue",
    async ({ params, headers }) => {
      const result = await reconcilePack(params.id);
      await audit(await actorOf(headers), { action: "certificate.bulk_issue", module: "certificate", targetId: params.id, after: result });
      void kickCertificateWorker();
      return result;
    },
    { params: idParam }
  )
  /** How many live certificates a template change would replace; shown before confirming. */
  .get("/packs/:id/impact", async ({ params }) => ({ live: await liveCount(params.id) }), { params: idParam })
  /**
   * Reissue the pack's live certificates on its current template. The old
   * revisions either stay verifiable as previous versions or are superseded.
   */
  .post(
    "/packs/:id/reissue",
    async ({ params, body, headers }) => {
      const issued = await reissueForTemplate(params.id, body.oldPolicy);
      await audit(await actorOf(headers), { action: "certificate.reissue_template", module: "certificate", targetId: params.id, after: { issued, oldPolicy: body.oldPolicy }, reason: body.reason });
      void kickCertificateWorker();
      return { issued };
    },
    { params: idParam, body: t.Object({ oldPolicy: t.Union([t.Literal("previous_valid"), t.Literal("superseded")]), reason: t.String({ minLength: 3, maxLength: 500 }) }) }
  )
  /** Public halves only; the private key never leaves CERT_KEY_DIR. */
  .get("/keys/list", async () => ({
    keys: await db
      .select({ keyId: certSigningKeys.keyId, algorithm: certSigningKeys.algorithm, active: certSigningKeys.active, createdAt: certSigningKeys.createdAt, retiredAt: certSigningKeys.retiredAt })
      .from(certSigningKeys)
      .orderBy(desc(certSigningKeys.createdAt)),
  }))
  /** New signing key for certificates issued from now on; older ones keep verifying with their own key. */
  .post(
    "/keys/rotate",
    async ({ body, headers }) => {
      const keyId = await rotateKey();
      await audit(await actorOf(headers), { action: "certificate.key_rotate", module: "certificate", targetId: keyId, reason: body.reason });
      return { keyId };
    },
    { body: reasonBody }
  );

const fraction = t.Number({ minimum: -0.5, maximum: 1.5 });
const color = t.String({ pattern: "^#[0-9a-fA-F]{6}$" });
const upload = t.String({ maxLength: 200, pattern: "^/api/uploads/[a-f0-9]{32}\\.(png|jpg|webp|gif)$" });
const elementId = t.String({ minLength: 1, maxLength: 40 });

const layoutSchema = t.Object({
  paper: t.Union([t.Literal("a4-landscape"), t.Literal("a4-portrait")]),
  /** Uploaded files only: the renderer never fetches a URL. */
  background: t.Union([upload, t.Null()]),
  backgroundFit: t.Optional(t.Object({ zoom: t.Number({ minimum: 1, maximum: 4 }), offsetX: t.Number({ minimum: -1, maximum: 1 }), offsetY: t.Number({ minimum: -1, maximum: 1 }) })),
  decor: t.Union([t.Literal("standard"), t.Literal("none")]),
  elements: t.Array(
    t.Union([
      t.Object({
        id: elementId,
        type: t.Literal("text"),
        text: t.String({ maxLength: 1000 }),
        x: fraction,
        y: fraction,
        w: t.Number({ minimum: 0.02, maximum: 1 }),
        size: t.Number({ minimum: 8, maximum: 400 }),
        weight: t.Union([t.Literal(400), t.Literal(500), t.Literal(600)]),
        font: t.Union([t.Literal("display"), t.Literal("body")]),
        color,
        align: t.Union([t.Literal("left"), t.Literal("center"), t.Literal("right")]),
        fit: t.Optional(t.Boolean()),
        lineHeight: t.Optional(t.Number({ minimum: 1.6, maximum: 3 })),
      }),
      t.Object({ id: elementId, type: t.Literal("image"), url: upload, x: fraction, y: fraction, w: t.Number({ minimum: 0.01, maximum: 1 }), h: t.Number({ minimum: 0.01, maximum: 1 }), crop: t.Optional(t.Object({zoom:t.Number({minimum:1,maximum:4}),offsetX:t.Number({minimum:-1,maximum:1}),offsetY:t.Number({minimum:-1,maximum:1})})) }),
      t.Object({ id: elementId, type: t.Literal("qr"), x: fraction, y: fraction, size: t.Number({ minimum: 0.05, maximum: 0.4 }) }),
    ]),
    { maxItems: 60 }
  ),
});

/** Long Thai and English names on purpose: a template has to survive both (3.2). */
const SAMPLE: CertData = {
  recipient_full_name: "ปัณณวิชญ์ เจริญเลิศกมลวัฒนพงศ์",
  grade: "ระดับชั้น ม.1",
  subject: "คณิตศาสตร์",
  exam_title: "ข้อสอบเสมือนจริง ชุดที่ 1",
  certificate_id: "PT-000123",
  issue_date: "13 พฤศจิกายน 2569",
  issuer_name: "พี่ที",
  score: "82.5",
  max_score: "100",
  percent: "83%", rank: "",
};

const templateColumns = {
  id: certTemplates.id,
  name: certTemplates.name,
  status: certTemplates.status,
  publishedVersion: certTemplates.publishedVersion,
  updatedAt: certTemplates.updatedAt,
};

export const adminCertTemplatesRoutes = new Elysia({ prefix: "/admin/cert-templates" })
  .use(adminGuard)
  .get("/", async () => ({
    templates: await db
      .select({ ...templateColumns, usedByPacks: sql<number>`(select count(*) from exam_packs p where p.cert_template_id = cert_templates.id)` })
      .from(certTemplates)
      .orderBy(desc(certTemplates.updatedAt)),
    fields: CERT_FIELDS,
    defaultLayout: DEFAULT_LAYOUT,
  }))
  .get(
    "/:id",
    async ({ params, set }) => {
      const [template] = await db.select().from(certTemplates).where(eq(certTemplates.id, params.id)).limit(1);
      if (!template) {
        set.status = 404;
        return { error: "ไม่พบเทมเพลต" };
      }
      return { template, problems: layoutProblems(template.layout), fields: CERT_FIELDS };
    },
    { params: idParam }
  )
  /** New draft; starts from the built-in layout, or copies `fromId` (duplicate). */
  .post(
    "/",
    async ({ body, headers, set }) => {
      let layout: CertLayout = DEFAULT_LAYOUT;
      if (body.fromId) {
        const [src] = await db.select({ layout: certTemplates.layout }).from(certTemplates).where(eq(certTemplates.id, body.fromId)).limit(1);
        if (!src) {
          set.status = 404;
          return { error: "ไม่พบเทมเพลตต้นฉบับ" };
        }
        layout = src.layout;
      }
      const [template] = await db.insert(certTemplates).values({ name: body.name.trim(), layout }).returning();
      await audit(await actorOf(headers), { action: "template.create", module: "certificate", targetId: template!.id, after: { name: template!.name, fromId: body.fromId ?? null } });
      set.status = 201;
      return { template };
    },
    { body: t.Object({ name: t.String({ minLength: 1, maxLength: 120 }), fromId: t.Optional(t.String({ format: "uuid" })) }) }
  )
  /** Save the draft. Published versions already in use are untouched until "publish". */
  .put(
    "/:id",
    async ({ params, body, headers, set }) => {
      const [before] = await db.select({ name: certTemplates.name, layout: certTemplates.layout }).from(certTemplates).where(eq(certTemplates.id, params.id)).limit(1);
      const [template] = await db
        .update(certTemplates)
        .set({ name: body.name.trim(), layout: body.layout as CertLayout, updatedAt: new Date() })
        .where(eq(certTemplates.id, params.id))
        .returning();
      if (!template) {
        set.status = 404;
        return { error: "ไม่พบเทมเพลต" };
      }
      await audit(await actorOf(headers), { action: "template.update", module: "certificate", targetId: template.id, before, after: { name: template.name, layout: template.layout } });
      return { template, problems: layoutProblems(template.layout) };
    },
    { params: idParam, body: t.Object({ name: t.String({ minLength: 1, maxLength: 120 }), layout: layoutSchema }) }
  )
  /**
   * Freeze the draft as a new version. New certificates use it; certificates
   * already issued keep their version until the admin reissues the pack.
   */
  .post(
    "/:id/publish",
    async ({ params, headers, set }) => {
      const [template] = await db.select().from(certTemplates).where(eq(certTemplates.id, params.id)).limit(1);
      if (!template) {
        set.status = 404;
        return { error: "ไม่พบเทมเพลต" };
      }
      const problems = layoutProblems(template.layout);
      if (problems.length > 0) {
        set.status = 422;
        return { error: problems.join(" · "), problems };
      }
      const version = template.publishedVersion + 1;
      await db.transaction(async (tx) => {
        await tx.insert(certTemplateVersions).values({ templateId: template.id, version, layout: template.layout });
        await tx.update(certTemplates).set({ status: "published", publishedVersion: version, updatedAt: new Date() }).where(eq(certTemplates.id, template.id));
      });
      await audit(await actorOf(headers), { action: "template.publish", module: "certificate", targetId: template.id, after: { version } });
      return { version };
    },
    { params: idParam }
  )
  /** Only a template no pack uses and no certificate was printed from can go. */
  .delete(
    "/:id",
    async ({ params, headers, set }) => {
      const [[packs], [used]] = await Promise.all([
        db.select({ n: sql<number>`count(*)` }).from(examPacks).where(eq(examPacks.certTemplateId, params.id)),
        db
          .select({ n: sql<number>`count(*)` })
          .from(certificates)
          .innerJoin(certTemplateVersions, eq(certTemplateVersions.id, certificates.templateVersionId))
          .where(eq(certTemplateVersions.templateId, params.id)),
      ]);
      if (Number(packs?.n ?? 0) > 0 || Number(used?.n ?? 0) > 0) {
        set.status = 409;
        return { error: "เทมเพลตนี้มีชุดข้อสอบใช้อยู่ หรือมีเกียรติบัตรที่ออกจากเทมเพลตนี้แล้ว ลบไม่ได้" };
      }
      const deleted = await db.delete(certTemplates).where(eq(certTemplates.id, params.id)).returning({ id: certTemplates.id });
      if (deleted.length === 0) {
        set.status = 404;
        return { error: "ไม่พบเทมเพลต" };
      }
      await audit(await actorOf(headers), { action: "template.delete", module: "certificate", targetId: params.id });
      return { ok: true };
    },
    { params: idParam }
  )
  /** Real render of the unsaved layout: light PNG for the editor, full-resolution PDF for inspection. */
  .post(
    "/preview",
    async ({ body, set }) => {
      const layout = body.layout as CertLayout;
      const pdf = body.format === "pdf";
      const png = await renderPng({ layout, data: { ...SAMPLE, ...(body.longEnglishName ? { recipient_full_name: "Alexandria Montgomery-Wellington Rattanakosin" } : {}) }, verifyUrl: `${publicUrl()}/cert/preview` }, pdf ? 1.5 : 0.6);
      const file = pdf ? await pngToPdf(png, layout.paper, "ตัวอย่างเกียรติบัตร") : new Uint8Array(png);
      return new Response(new Uint8Array(file), { headers: { "content-type": pdf ? "application/pdf" : "image/png", "cache-control": "no-store", ...(pdf ? { "content-disposition": 'attachment; filename="certificate-preview.pdf"' } : {}) } });
    },
    { body: t.Object({ layout: layoutSchema, longEnglishName: t.Optional(t.Boolean()), format: t.Optional(t.Union([t.Literal("png"), t.Literal("pdf")])) }) }
  );
