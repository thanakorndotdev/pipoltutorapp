/**
 * Run from backend/app: bun run test:certificates
 * Creates and migrates a disposable database on the configured PostgreSQL host.
 * Does not alter the application database, live jobs, files or signing keys.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { databaseUrl } from "../src/db/env";

if (!process.argv.includes("--isolated")) {
  const { sql } = await import("../src/db");
  const name = `pipol_cert_test_${randomUUID().replaceAll("-", "")}`;
  const directory = await mkdtemp(join(tmpdir(), "pipol-cert-test-"));
  let created = false;
  try {
    await sql`create database ${sql(name)}`;
    created = true;
    const url = new URL(databaseUrl());
    url.pathname = `/${name}`;
    const env = {
      ...process.env,
      DATABASE_URL: url.toString(),
      CERT_DIR: join(directory, "files"),
      CERT_KEY_DIR: join(directory, "keys"),
      ADMIN_API_KEY: randomUUID(),
      ALLOW_DEV_AUTH: "0",
      PUBLIC_URL: "http://localhost:3000",
    };
    for (const cmd of [
      ["bun", "run", "db:migrate"],
      ["bun", "run", import.meta.path, "--isolated"],
    ]) {
      const child = Bun.spawn(cmd, {
        env,
        stdout: "inherit",
        stderr: "inherit",
      });
      assert.equal(await child.exited, 0, `${cmd[2]} failed`);
    }
  } finally {
    // Only the database with this run's random name is ever removed.
    if (created) await sql`drop database ${sql(name)} with (force)`;
    await sql.end();
    await rm(directory, { recursive: true, force: true });
  }
} else {
  assert.match(
    new URL(databaseUrl()).pathname,
    /^\/pipol_cert_test_[a-f0-9]{32}$/,
  );
  const jsQR = (await import("jsqr")).default;
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const { Elysia } = await import("elysia");
  const { eq } = await import("drizzle-orm");
  const { db, sql } = await import("../src/db");
  const {
    attempts,
    auditLogs,
    certificateJobs,
    certificates,
    certTemplates,
    examPacks,
    users,
  } = await import("../src/db/schema");
  const { adminPacksRoutes } = await import("../src/routes/admin/packs");
  const { adminCertificatesRoutes, adminCertTemplatesRoutes } =
    await import("../src/routes/admin/certificates");
  const { certificatesRoutes, certVerifyRoutes } =
    await import("../src/routes/certificates");
  const { createSession } = await import("../src/sessions");
  const { DEFAULT_LAYOUT } = await import("../src/certificates/layout");
  const { certFile, reconcileAttempt, reissueForRename } =
    await import("../src/certificates/issue");
  const { kickCertificateWorker } = await import("../src/certificates/worker");
  const { rotateKey, verifyManifest } =
    await import("../src/certificates/keys");
  const { lifecycleRoutes } = await import("../src/routes/lifecycle");
  const app = new Elysia()
    .use(lifecycleRoutes)
    .use(adminPacksRoutes)
    .use(adminCertificatesRoutes)
    .use(adminCertTemplatesRoutes)
    .use(certificatesRoutes)
    .use(certVerifyRoutes);
  const admin = { "x-admin-key": process.env.ADMIN_API_KEY! };
  let checks = 0;
  const evidence: string[] = [];
  function ok(description: string) {
    evidence.push(description);
    console.log(`PASS ${++checks}: ${description}`);
  }
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = admin,
  ) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...headers,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  }
  async function json<T>(
    path: string,
    method = "GET",
    body?: unknown,
    status = 200,
  ): Promise<T> {
    const res = await request(path, method, body);
    assert.equal(
      res.status,
      status,
      `${method} ${path}: ${await res.clone().text()}`,
    );
    return res.json() as Promise<T>;
  }
  async function readCert(id: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id));
    assert.ok(row);
    return row;
  }
  async function ready(id: string) {
    for (let n = 0; n < 200; n++) {
      const row = await readCert(id);
      if (row.status === "valid") return row;
      await Bun.sleep(25);
    }
    throw new Error(`Certificate ${id} did not finish rendering`);
  }

  try {
    assert.equal(
      (await request("/admin/cert-templates", "GET", undefined, {})).status,
      401,
    );
    ok("admin endpoints require authentication");
    const { template } = await json<{ template: { id: string } }>(
      "/admin/cert-templates",
      "POST",
      { name: "Integration template" },
      201,
    );
    const packInput = {
      slug: "certificate-integration",
      title: "ทดสอบเกียรติบัตร",
      description: null,
      questionCount: 1,
      durationSeconds: 60,
      maxAttempts: null,
      opensAt: null,
      closesAt: null,
      published: false,
      showReview: false,
      paperUrl: null,
      level: "m4",
      subjectLabel: "คณิตศาสตร์",
      certificateEnabled: true,
      certOnAutoSubmit: false,
      certOnHardCutoff: false,
      certOnReopen: false,
      certTemplateId: template.id,
    };
    await json(
      "/admin/packs",
      "POST",
      { ...packInput, slug: "draft-must-be-rejected" },
      422,
    );
    ok("creating a pack rejects unpublished certificate templates");

    const layout = structuredClone(DEFAULT_LAYOUT);
    const text = layout.elements.find((e) => e.type === "text");
    assert.ok(text && text.type === "text");
    text.lineHeight = 1.8;
    await json(`/admin/cert-templates/${template.id}`, "PUT", {
      name: "Integration template",
      layout,
    });
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "template.update"));
    assert.equal(logs.length, 1);
    assert.ok(logs[0]!.before && logs[0]!.after);
    await json(`/admin/cert-templates/${template.id}/publish`, "POST");
    ok(
      "draft save records audit data and publishes a version with line spacing",
    );
    for (const paper of ["a4-landscape", "a4-portrait"] as const) {
      for (const longEnglishName of [false, true]) {
        for (const format of ["png", "pdf"] as const) {
          const res = await request("/admin/cert-templates/preview", "POST", {
            layout: { ...layout, paper },
            longEnglishName,
            format,
          });
          assert.equal(res.status, 200);
          assert.equal(res.headers.get("cache-control"), "no-store");
          assert.equal(
            res.headers.get("content-type"),
            format === "pdf" ? "application/pdf" : "image/png",
          );
          const bytes = new Uint8Array(await res.arrayBuffer());
          assert.ok(bytes.length > 1000);
          assert.equal(
            Buffer.from(bytes.subarray(0, format === "pdf" ? 4 : 8)).toString(
              format === "pdf" ? "ascii" : "hex",
            ),
            format === "pdf" ? "%PDF" : "89504e470d0a1a0a",
          );
          if (paper === "a4-landscape" && longEnglishName && format === "pdf")
            await Bun.write(
              join(process.env.CERT_DIR!, "..", "preview.pdf"),
              bytes,
            );
        }
      }
    }
    const invalid = structuredClone(layout);
    const invalidText = invalid.elements.find((e) => e.type === "text");
    assert.ok(invalidText && invalidText.type === "text");
    invalidText.lineHeight = 1;
    await json(
      "/admin/cert-templates/preview",
      "POST",
      { layout: invalid },
      422,
    );
    ok(
      "PNG/PDF previews render both paper orientations and long Thai/English names; invalid spacing is rejected",
    );

    const { pack } = await json<{ pack: { id: string } }>(
      "/admin/packs",
      "POST",
      packInput,
      201,
    );
    const changed = {
      ...packInput,
      level: "m1",
      subjectLabel: "วิทยาศาสตร์",
      certOnAutoSubmit: true,
    };
    const updated = await json<{ pack: typeof changed }>(
      `/admin/packs/${pack.id}`,
      "PUT",
      changed,
    );
    for (const field of [
      "level",
      "subjectLabel",
      "certificateEnabled",
      "certOnAutoSubmit",
      "certOnHardCutoff",
      "certOnReopen",
      "certTemplateId",
    ] as const)
      assert.equal(updated.pack[field], changed[field]);
    ok("pack create/update preserves every certificate setting");

    const [owner, other] = await db
      .insert(users)
      .values([
        {
          googleId: "certificate-owner",
          email: "certificate-owner@pipoltutor.test",
          firstName: "ปัณณวิชญ์",
          lastName: "เจริญเลิศกมลวัฒนพงศ์",
        },
        {
          googleId: "certificate-other",
          email: "certificate-other@pipoltutor.test",
          firstName: "ผู้ทดสอบ",
          lastName: "อีกบัญชี",
        },
      ])
      .returning();
    assert.ok(owner && other);
    const [attempt] = await db
      .insert(attempts)
      .values({
        userId: owner.id,
        packId: pack.id,
        status: "submitted",
        startedAt: new Date(Date.now() - 60_000),
        submittedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        score: 1,
        maxScore: 1,
      })
      .returning();
    assert.ok(attempt);
    const ids = await Promise.all(
      Array.from({ length: 6 }, () => reconcileAttempt(attempt.id)),
    );
    assert.ok(ids[0]);
    assert.equal(new Set(ids).size, 1);
    const id = ids[0]!;
    const [job] = await db
      .select()
      .from(certificateJobs)
      .where(eq(certificateJobs.certificateId, id));
    assert.ok(job);
    // A regular file at CERT_DIR deterministically makes mkdir/render output fail once.
    await Bun.write(process.env.CERT_DIR!, "intentional render failure");
    await kickCertificateWorker();
    assert.equal((await readCert(id)).status, "render_failed");
    const [failed] = await db
      .select()
      .from(certificateJobs)
      .where(eq(certificateJobs.id, job.id));
    assert.equal(failed!.tries, 1);
    assert.equal(failed!.status, "pending");
    assert.ok(failed!.runAfter.getTime() > Date.now());
    await unlink(process.env.CERT_DIR!);
    await mkdir(process.env.CERT_DIR!);
    // Advance this isolated job's due date instead of waiting for the real backoff.
    await db
      .update(certificateJobs)
      .set({ runAfter: new Date(0) })
      .where(eq(certificateJobs.id, job.id));
    await kickCertificateWorker();
    const valid = await readCert(id);
    assert.equal(valid.status, "valid");
    const [retried] = await db
      .select()
      .from(certificateJobs)
      .where(eq(certificateJobs.certificateId, id));
    assert.equal(retried!.id, job.id);
    assert.equal(retried!.status, "done");
    assert.ok(valid.manifest && valid.signature);
    assert.equal(await verifyManifest(valid.manifest, valid.signature), true);
    ok(
      "AC-08: first render fails, automatic retry succeeds with the same certificate and job; concurrent issue does not duplicate",
    );

    const ownerHeaders = {
      cookie: `pt_session=${(await createSession(owner.id)).token}`,
    };
    const otherHeaders = {
      cookie: `pt_session=${(await createSession(other.id)).token}`,
    };
    for (const format of ["png", "pdf"]) {
      const path = `/certificates/${id}/file?format=${format}`;
      assert.equal((await request(path, "GET", undefined, {})).status, 401);
      assert.equal(
        (await request(path, "GET", undefined, otherHeaders)).status,
        404,
      );
      const first = await request(path, "GET", undefined, ownerHeaders);
      assert.equal(first.status, 200);
      assert.equal(first.headers.get("cache-control"), "private, no-store");
      const second = await request(path, "GET", undefined, ownerHeaders);
      assert.deepEqual(await first.arrayBuffer(), await second.arrayBuffer());
      assert.ok(await Bun.file(certFile(id, format as "png" | "pdf")).exists());
    }
    await db.update(users).set({staffRole:"admin",modulePermissions:{certificate:[]}}).where(eq(users.id,other.id));
    assert.equal((await request(`/certificates/${id}/file?format=pdf`,"GET",undefined,otherHeaders)).status,404);
    await db.update(users).set({staffRole:"none",modulePermissions:{}}).where(eq(users.id,other.id));
    const publicResult = await json<Record<string, unknown>>(
      `/cert/${valid.publicId}`,
    );
    assert.equal(publicResult.signatureValid, true);
    for (const key of [
      "recipientName",
      "recipient_name",
      "email",
      "score",
      "attemptId",
      "attempt_id",
    ])
      assert.equal(key in publicResult, false);
    const pngImage = await loadImage(
      new Uint8Array(await Bun.file(certFile(id, "png")).arrayBuffer()),
    );
    for (const scale of [1, 0.5]) {
      const canvas = createCanvas(
        Math.round(pngImage.width * scale),
        Math.round(pngImage.height * scale),
      );
      const ctx = canvas.getContext("2d");
      ctx.drawImage(pngImage, 0, 0, canvas.width, canvas.height);
      const decoded = jsQR(
        new Uint8ClampedArray(
          ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        ),
        canvas.width,
        canvas.height,
      );
      assert.equal(
        decoded?.data,
        `http://localhost:3000/cert/${valid.publicId}`,
      );
    }
    // Rasterize the actual downloaded PDF, then decode the printed QR at
    // full A4 raster size and a smaller share-sized raster (not the source PNG).
    const pdfBytes = await Bun.file(certFile(id,"pdf")).arrayBuffer();
    const pdfEvidence: {scale:number;width:number;height:number;decoded:boolean}[] = [];
    for (const scale of [2,1]) {
      const raster=Bun.spawn(["python3", "scripts/render-pdf-page.py",String(scale)],{stdin:new Uint8Array(pdfBytes),stdout:"pipe",stderr:"pipe"});
      const [bytes,stderr]=await Promise.all([new Response(raster.stdout).arrayBuffer(),new Response(raster.stderr).text()]);
      assert.equal(await raster.exited,0,stderr);
      const page=await loadImage(new Uint8Array(bytes));
      const canvas=createCanvas(page.width,page.height), ctx=canvas.getContext("2d");ctx.drawImage(page,0,0);
      const decoded=jsQR(new Uint8ClampedArray(ctx.getImageData(0,0,page.width,page.height).data),page.width,page.height);
      assert.equal(decoded?.data,`http://localhost:3000/cert/${valid.publicId}`);
      pdfEvidence.push({scale,width:page.width,height:page.height,decoded:true});
    }
    await Bun.write("../../manuals/pdf-qr-result.json",JSON.stringify({date:new Date().toISOString(),source:"original signed certificate PDF from isolated API test",renderer:"PyMuPDF",results:pdfEvidence,limits:["Automated raster decoding; physical paper and camera remain a human acceptance check"]},null,2)+"\n");
    ok("AC-05 original PDF QR decodes at 144dpi and 72dpi after actual page rasterization");
    const badName = await request(
      `/cert/${valid.publicId}/verify-name`,
      "POST",
      { name: "ชื่อปลอม" },
      {},
    );
    assert.equal(badName.status, 200);
    assert.equal((await badName.json()).match, false);
    // Rotating client addresses must not multiply the guess budget for one certificate.
    for (let i = 1; i < 30; i++) {
      const r = await request(`/cert/${valid.publicId}/verify-name`, "POST", { name: `เดา${i}` }, { "x-forwarded-for": `198.51.100.${i}` });
      assert.equal(r.status, 200);
    }
    const capped = await request(`/cert/${valid.publicId}/verify-name`, "POST", { name: "เดาเกิน" }, { "x-forwarded-for": "203.0.113.7" });
    assert.equal(capped.status, 429);
    ok(
      "AC-03/05 QR decodes original PNG and half-size share image; tampered printed name does not match",
    );
    const tampered = { ...valid.manifest, recipient_name: "ชื่อปลอม" };
    assert.equal(await verifyManifest(tampered, valid.signature), false);
    await rotateKey();
    assert.equal(await verifyManifest(valid.manifest, valid.signature), true);
    ok(
      "owner-only downloads are stable; public verification hides personal data; tampering fails and key rotation preserves old verification",
    );

    await db
      .update(users)
      .set({ firstName: "ชื่อใหม่" })
      .where(eq(users.id, owner.id));
    assert.equal(await reissueForRename(owner.id), 1);
    assert.equal((await readCert(id)).status, "revoked");
    const replacementId = await reconcileAttempt(attempt.id);
    assert.ok(replacementId && replacementId !== id);
    await kickCertificateWorker();
    const replacement = await ready(replacementId);
    assert.notEqual(replacement.publicId, valid.publicId);
    assert.equal(replacement.recipientName, "ชื่อใหม่ เจริญเลิศกมลวัฒนพงศ์");
    ok(
      "name changes revoke the old certificate and render a new revision with a new public ID",
    );
    const { reissueForTemplate } = await import("../src/certificates/issue");
    await json(`/admin/cert-templates/${template.id}/publish`, "POST");
    assert.equal(await reissueForTemplate(pack.id, "previous_valid"), 1);
    assert.equal((await readCert(replacementId)).status, "previous_valid");
    const templateId = await reconcileAttempt(attempt.id);
    assert.ok(templateId && templateId !== replacementId);
    await kickCertificateWorker();
    await ready(templateId);
    await json(`/admin/cert-templates/${template.id}/publish`, "POST");
    assert.equal(await reissueForTemplate(pack.id, "superseded"), 1);
    assert.equal((await readCert(templateId)).status, "superseded");
    ok("AC-09 template reissue honours previous-valid and superseded policies");
    const secondAttempt = (
      await db
        .insert(attempts)
        .values({
          userId: owner.id,
          packId: pack.id,
          status: "submitted",
          score: 999,
          maxScore: 1000,
          expiresAt: new Date(),
          submittedAt: new Date(),
        })
        .returning()
    )[0]!;
    const secondCert = await reconcileAttempt(secondAttempt.id);
    assert.ok(secondCert);
    await kickCertificateWorker();
    await ready(secondCert);
    const choices = await request(
      "/certificates",
      "GET",
      undefined,
      ownerHeaders,
    );
    const certificateChoices = (await choices.json()).certificates as {
      attemptId: string;
      isDefault: boolean;
    }[];
    assert.ok(certificateChoices.some((c) => c.attemptId === attempt.id));
    assert.ok(certificateChoices.some((c) => c.attemptId === secondAttempt.id));
    assert.equal(certificateChoices.filter((c) => c.isDefault).length, 1);
    assert.equal(
      certificateChoices.find((c) => c.isDefault)?.attemptId,
      secondAttempt.id,
    );
    ok(
      "AC-07 multiple attempts list separately and best score is the default certificate",
    );
    const auto = (
      await db
        .insert(attempts)
        .values({
          userId: other.id,
          packId: pack.id,
          status: "expired",
          expiresAt: new Date(),
          submittedAt: new Date(),
        })
        .returning()
    )[0]!;
    await db
      .update(examPacks)
      .set({ certOnAutoSubmit: false, certOnHardCutoff: false })
      .where(eq(examPacks.id, pack.id));
    assert.equal(await reconcileAttempt(auto.id), null);
    await db
      .update(examPacks)
      .set({ certOnAutoSubmit: true })
      .where(eq(examPacks.id, pack.id));
    const autoCert = await reconcileAttempt(auto.id);
    assert.ok(autoCert);
    await kickCertificateWorker();
    await ready(autoCert);
    ok("AC-10 automatic submit issuance follows per-pack eligibility");
    const keep = await request(
      "/profile/delete",
      "POST",
      { certificatePolicy: "keep", consent: true, confirmation: "ลบบัญชีของฉัน" },
      otherHeaders,
    );
    assert.equal(keep.status, 200);
    assert.equal((await readCert(autoCert)).status, "valid");
    const del = await request(
      "/profile/delete",
      "POST",
      {
        certificatePolicy: "revoke",
        consent: true,
        confirmation: "ลบบัญชีของฉัน",
      },
      ownerHeaders,
    );
    assert.equal(del.status, 200);
    assert.equal((await readCert(replacementId)).status, "revoked");
    ok(
      "CERT-15 both keep and revoke deletion consent paths preserve referential integrity",
    );
    await Bun.write(
      "../../manuals/certificate-test-result.json",
      JSON.stringify(
        { date: new Date().toISOString(), passed: checks, checks: evidence },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Certificate integration: ${checks} checks passed (disposable database).`,
    );
  } finally {
    await sql.end();
  }
}
