/** Acceptance gaps from HANDOFF: taxonomy, media, CMS telemetry and daily analytics. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { app } from "../src/app";
import { db, sql } from "../src/db";
import { databaseUrl } from "../src/db/env";
import { articles, attempts, examPacks, notifications, users } from "../src/db/schema";
import { categories, dailyChallenges, featureSettings } from "../src/db/features";
import { createSession } from "../src/sessions";
import { bangkokDay } from "../src/features/common";
import { refreshRanking } from "../src/features/ranking";

assert.match(new URL(databaseUrl()).pathname, /^\/pipol_sow_test_[a-f0-9]{32}$/);
const admin = { "x-admin-key": process.env.ADMIN_API_KEY! };
const checks: string[] = [];
const pass = (name: string) => { checks.push(name); console.log(`PASS ${checks.length}: ${name}`); };
async function req(path: string, method = "GET", body?: unknown, headers: Record<string, string> = admin) {
  return app.handle(new Request(`http://localhost${path}`, { method, headers: { ...headers, ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) }));
}
async function j<T>(path: string, method = "GET", body?: unknown, status = 200, headers: Record<string, string> = admin): Promise<T> {
  const r = await req(path, method, body, headers);
  assert.equal(r.status, status, `${method} ${path}: ${await r.clone().text()}`);
  return r.json() as Promise<T>;
}
async function person(label: string, staffRole: "none" | "author" = "none") {
  const [row] = await db.insert(users).values({ googleId: randomUUID(), email: `${label}@pipoltutor.test`, staffRole }).returning();
  return { id: row!.id, headers: { cookie: `pt_session=${(await createSession(row!.id)).token}` } };
}
try {
  const author = await person("author", "author"), student = await person("student"), second = await person("second");
  const taxonomy = async (name: string, parentId: string | null = null) => (await j<{ category: { id: string } }>("/admin/cms/categories", "POST", { name, slug: name, kind: "topic", parentId, sortOrder: 0 })).category.id;
  const from = await taxonomy("from"), to = await taxonomy("to"), child = await taxonomy("child", from);
  await j(`/admin/cms/categories/${from}`, "PUT", { name: "from", parentId: child, sortOrder: 0 }, 422);
  await j("/admin/cms/merge/preview", "POST", { from, to: child, reason: "ห้ามวนหมวด" }, 422);
  const article = (await j<{ article: { id: string; revision: number } }>("/admin/articles", "POST", { title: "สื่อและบทเรียน", slug: "delivery-lesson", excerpt: "เนื้อหาทดสอบ", coverUrl: null, blocks: [{ type: "text", text: "เนื้อหาที่อนุมัติ" }], categoryIds: [from] }, 201, author.headers)).article;
  let revision = article.revision;
  for (const action of ["submit", "approve", "publish"]) revision = (await j<{ article: { revision: number } }>(`/admin/articles/${article.id}/workflow`, "POST", { action, baseRevision: revision })).article.revision;
  await j(`/admin/cms/categories/${from}`, "DELETE", { reason: "ยังมีเนื้อหา" }, 409);
  const preview = await j<{ previewId: string; affected: { id: string }[] }>("/admin/cms/merge/preview", "POST", { from, to, reason: "รวมหมวดทดสอบ" });
  assert.equal(preview.affected.length, 1);
  assert.ok((await db.select().from(categories).where(eq(categories.id, from))).length);
  await j("/admin/cms/merge/commit", "POST", { previewId: preview.previewId });
  await j("/admin/cms/merge/commit", "POST", { previewId: preview.previewId }, 409);
  assert.equal((await db.select().from(categories).where(eq(categories.id, child)))[0]!.parentId, to);
  assert.equal((await db.select().from(featureSettings).where(eq(featureSettings.key, `taxonomy.alias.${from}`)))[0]!.value, to);
  const publicArticle = await j<{ article: { categoryIds: string[]; blocks: { text: string }[] } }>("/articles/delivery-lesson", "GET", undefined, 200, {});
  assert.deepEqual(publicArticle.article.categoryIds, [to]);
  assert.equal((await j<{ total: number }>(`/articles?category=${from}`, "GET", undefined, 200, {})).total, 1);
  pass("CMS-02 taxonomy rejects cycles; merge preview/commit updates children, published snapshot and historical category alias once");
  const current = (await db.select().from(articles).where(eq(articles.id, article.id)))[0]!;
  await j(`/admin/articles/${article.id}`, "PUT", { title: "ร่างใหม่", excerpt: null, coverUrl: null, blocks: [{ type: "text", text: "เนื้อหาที่ยังไม่อนุมัติ" }], baseRevision: current.revision });
  assert.equal((await j<{ article: { title: string } }>("/articles/delivery-lesson", "GET", undefined, 200, {})).article.title, "สื่อและบทเรียน");
  const visitor = { cookie: `pt_visitor=${"a".repeat(32)}` };
  for (let i = 0; i < 2; i++) await j("/articles/delivery-lesson/event", "POST", { kind: "view", referrer: "https://example.test/private?q=secret" }, 200, visitor);
  const { articleEvents } = await import("../src/db/features");
  const views = await db.select().from(articleEvents).where(eq(articleEvents.articleId, article.id));
  assert.equal(views.length, 1); assert.equal(views[0]!.referrer, "example.test");
  pass("CMS published snapshot stays frozen during draft edits; views deduplicate and retain referrer hostname only");
  const upload = async (bytes: Uint8Array, name: string, type: string, status = 200, headers = author.headers) => {
    const form = new FormData(); form.set("file", new File([new Uint8Array(bytes)], name, { type }));
    return j<{ url: string; name: string; type: string }>("/admin/media/attachments", "POST", form, status, headers);
  };
  const pdf = await PDFDocument.create(); pdf.addPage();
  const docs: { ext: string; type: string; bytes: Uint8Array }[] = [
    { ext: "pdf", type: "application/pdf", bytes: await pdf.save() },
  ];
  const workbook = new ExcelJS.Workbook(); workbook.addWorksheet("ทดสอบ").addRow(["หัวข้อ", "ภาษาไทย"]);
  docs.push({ ext: "xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) });
  // Minimal Open XML fixtures exercise actual zip content checks, not MIME alone.
  for (const [ext, folder, type] of [["docx", "word", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["pptx", "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]]) {
    const zip = new JSZip(); zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'); zip.file(`${folder}/document.xml`, "<document>ทดสอบ</document>");
    docs.push({ ext: ext!, type: type!, bytes: await zip.generateAsync({ type: "uint8array" }) });
  }
  for (const doc of docs) {
    const saved = await upload(doc.bytes, `ทดสอบ.${doc.ext}`, doc.type);
    const download = await req(saved.url.replace(/^\/api/, ""), "GET", undefined, {});
    assert.equal(download.status, 200); assert.equal(download.headers.get("content-type"), doc.type);
    assert.match(download.headers.get("content-disposition")!, /^attachment;/);
    assert.equal(download.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(new Uint8Array(await download.arrayBuffer()), doc.bytes);
  }
  await upload(new TextEncoder().encode("fake"), "fake.pdf", "application/pdf", 415);
  await upload(new TextEncoder().encode("%PDF-1.7 /JavaScript (alert)"), "active.pdf", "application/pdf", 415);
  await upload(docs[0]!.bytes, "wrong.xlsx", docs[1]!.type, 415);
  await upload(docs[0]!.bytes, "no-permission.pdf", "application/pdf", 403, student.headers);
  const macro = new JSZip(); macro.file("[Content_Types].xml", "<Types/>"); macro.file("word/document.xml", "<document/>"); macro.file("word/vbaProject.bin", "macro");
  await upload(await macro.generateAsync({ type: "uint8array" }), "macro.docx", docs[2]!.type, 415);
  pass("AC-22 media uploads/downloads PDF and Office; rejects spoofed MIME, active PDF, macros and unauthorized writers");
  const [notice] = await db.insert(notifications).values({ userId: student.id, kind: "article_reply", title: "ทดสอบแจ้งเตือน", body: "มีข้อความตอบกลับ", link: "/articles/delivery-lesson" }).returning();
  await j(`/notifications/${notice!.id}/dismiss`, "POST", {}, 404, second.headers);
  await j(`/notifications/${notice!.id}/dismiss`, "POST", {}, 200, student.headers);
  const dismissedAt = (await db.select().from(notifications).where(eq(notifications.id, notice!.id)))[0]!.dismissedAt;
  await j(`/notifications/${notice!.id}/dismiss`, "POST", {}, 200, student.headers);
  assert.equal((await db.select().from(notifications).where(eq(notifications.id, notice!.id)))[0]!.dismissedAt!.getTime(), dismissedAt!.getTime());
  assert.equal((await j<{ notifications: unknown[] }>("/notifications", "GET", undefined, 200, student.headers)).notifications.length, 0);
  assert.equal((await j<{ notifications: unknown[] }>("/notifications?all=1", "GET", undefined, 200, student.headers)).notifications.length, 1);
  pass("Dashboard notification history keeps dismissed notices; another account cannot dismiss them");
  const today = bangkokDay();
  await db.insert(dailyChallenges).values({ title: "สถิติทดสอบ", date: today, status: "scheduled", questions: [{ id: "analytics-q", type: "single", subject: "math", topic: "เลขจำนวนเต็ม", prompt: "2+3", choices: [{ key: "A", text: "4" }, { key: "B", text: "5" }], correctChoices: ["B"], acceptedAnswers: [], hint: "นับต่อ", showHint: true, explanation: "5", reveal: "finished" }] });
  for (const [p, choices] of [[student, ["A", "B"]], [second, ["A", "A"]]] as const) for (const choice of choices) await j("/daily/submit", "POST", { date: today, questionId: "analytics-q", answer: { selectedChoices: [choice], textAnswer: null }, requestId: randomUUID() }, 200, p.headers);
  const analytics = await j<{ byDay: { participants: number; increased: number; successPct: number }[]; byQuestion: { users: number; correctUsers: number; firstTryCorrect: number; hints: number; successPct: number }[]; weakTopics: { wrongPct: number }[] }>(`/admin/daily/analytics?date=${today}`);
  assert.deepEqual(analytics.byDay[0], { date: today, participants: 2, increased: 1, successPct: 50 });
  assert.equal(analytics.byQuestion[0]!.users, 2); assert.equal(analytics.byQuestion[0]!.correctUsers, 1); assert.equal(analytics.byQuestion[0]!.firstTryCorrect, 0); assert.equal(analytics.byQuestion[0]!.hints, 2); assert.equal(analytics.byQuestion[0]!.successPct, 50); assert.equal(analytics.weakTopics[0]!.wrongPct, 50);
  pass("SoW 6.4 daily analytics count participants, first-try success, hints and weak topics across both tries");
  const [pack] = await db.insert(examPacks).values({ title: "ธงรอตรวจ", slug: randomUUID(), questionCount: 1, durationSeconds: 60 }).returning();
  await db.insert(attempts).values({ packId: pack!.id, userId: student.id, status: "submitted", score: 1, maxScore: 1, activeSeconds: null, activeVerified: false, expiresAt: new Date(), submittedAt: new Date() });
  await refreshRanking(pack!.id);
  const health = await j<{ pendingFlags: number; fire: { questions: number; today: { state: string; n: number }[] } }>("/admin/module-health");
  assert.equal(health.pendingFlags, 1); assert.equal(health.fire.questions, 1);
  assert.ok(health.fire.today.some(e => e.state === "increased" && e.n === 1));
  const plan = await j<{ previewId: string }>(`/admin/ranking/${pack!.id}/preview`, "POST", { changes: [{ userId: student.id, included: true, reason: "ตรวจแล้วคงไว้" }] });
  await j(`/admin/ranking/${pack!.id}/commit`, "POST", { previewId: plan.previewId });
  assert.equal((await j<{ pendingFlags: number }>("/admin/module-health")).pendingFlags, 0);
  pass("SoW 8.1 overview counts unresolved flags and today's Fire; explicit review clears the pending count");
  {
    // STAT-07: one reviewed bulk action over 100 selected attempts.
    const [bulkPack] = await db.insert(examPacks).values({ title: "คัดหลายรายการ", slug: randomUUID(), questionCount: 1, durationSeconds: 60 }).returning();
    const people = await db.insert(users).values(Array.from({ length: 120 }, (_, i) => ({ googleId: randomUUID(), email: `bulk${i}@pipoltutor.test` }))).returning();
    await db.insert(attempts).values(people.map((u, i) => ({ packId: bulkPack!.id, userId: u.id, status: "submitted" as const, score: i % 10, maxScore: 10, activeSeconds: 30 + i, activeVerified: true, expiresAt: new Date(), submittedAt: new Date() })));
    type View = { versionId: string; snapshot: { nRank: number; nRef: number } };
    const before = await j<View>(`/admin/ranking/${bulkPack!.id}`);
    assert.equal(before.snapshot.nRank, 120); assert.equal(before.snapshot.nRef, 120);
    const changes = people.slice(0, 100).map(u => ({ userId: u.id, included: false, reason: "ข้อมูลทดสอบระบบ" }));
    const bulk = await j<{ previewId: string }>(`/admin/ranking/${bulkPack!.id}/preview`, "POST", { changes });
    assert.equal((await j<View>(`/admin/ranking/${bulkPack!.id}`)).snapshot.nRef, 120);
    await j(`/admin/ranking/${bulkPack!.id}/commit`, "POST", { previewId: bulk.previewId });
    await j(`/admin/ranking/${bulkPack!.id}/commit`, "POST", { previewId: bulk.previewId }, 409);
    const after = await j<View & { versions: { trigger: string; affectedCount: number }[] }>(`/admin/ranking/${bulkPack!.id}`);
    assert.equal(after.snapshot.nRank, 120); assert.equal(after.snapshot.nRef, 20);
    const { auditLogs } = await import("../src/db/schema");
    const trail = await db.select().from(auditLogs).where(eq(auditLogs.module, "ranking"));
    assert.ok(trail.some(a => a.actorKind === "api-key" && JSON.stringify(a.after ?? "").includes('"nRef":20')), "bulk commit audited with actor and result");
    pass("STAT-07 bulk exclusion of 100 selected attempts needs preview, commits once with audit; ranking keeps all 120");
  }
  {
    // SoW 10.2: approved retention purges only unlinked technical logs and learning events.
    const { errorLogs, retentionPolicies, articleEvents } = await import("../src/db/features");
    const { purgeExpired } = await import("../src/features/retention");
    const { auditLogs } = await import("../src/db/schema");
    const old = new Date(Date.now() - 40 * 86400000);
    await db.insert(errorLogs).values([{ module: "test", code: "old", message: "เก่า", createdAt: old }, { module: "test", code: "new", message: "ใหม่" }]);
    const [lesson] = await db.select().from(articles).where(eq(articles.slug, "delivery-lesson"));
    await db.insert(articleEvents).values({ articleId: lesson!.id, visitorKey: "old-visitor", day: "2026-01-01", kind: "view", createdAt: old });
    const policies = (await j<{ policies: { category: string; version: number }[]; automaticDeletion: string[] }>("/admin/retention"));
    assert.deepEqual(policies.automaticDeletion.sort(), ["learning_events", "technical_logs"]);
    // Nothing is deleted before the Owner approves a period.
    await purgeExpired();
    assert.equal((await db.select().from(errorLogs).where(eq(errorLogs.code, "old"))).length, 1);
    const owner = await db.insert(users).values({ googleId: randomUUID(), email: "retention-owner@pipoltutor.test", staffRole: "owner" }).returning();
    const ownerHeaders = { cookie: `pt_session=${(await createSession(owner[0]!.id)).token}` };
    for (const category of ["technical_logs", "learning_events", "attempts"]) {
      const p = policies.policies.find(x => x.category === category)!;
      await j(`/admin/retention/${category}`, "PUT", { days: 30, baseVersion: p.version, reason: "อนุมัตินโยบายทดสอบ" }, 200, ownerHeaders);
    }
    const attemptsBefore = (await db.select().from(attempts)).length;
    const result = await purgeExpired();
    assert.deepEqual(result, { technical_logs: 1, learning_events: 1 });
    assert.deepEqual((await db.select().from(errorLogs).where(eq(errorLogs.module, "test"))).map(e => e.code), ["new"]);
    assert.equal((await db.select().from(articleEvents).where(eq(articleEvents.visitorKey, "old-visitor"))).length, 0);
    assert.equal((await db.select().from(attempts)).length, attemptsBefore);
    assert.equal((await db.select().from(auditLogs).where(eq(auditLogs.action, "retention.purge"))).length, 2);
    assert.deepEqual(await purgeExpired(), { technical_logs: 0, learning_events: 0 });
    pass("SoW 10.2 approved retention purges expired technical logs and article events only, with system audit; linked data untouched");
  }
  await Bun.write("../../manuals/delivery-test-result.json", JSON.stringify({ date: new Date().toISOString(), passed: checks.length, checks }, null, 2) + "\n");
} finally { await sql.end(); }
