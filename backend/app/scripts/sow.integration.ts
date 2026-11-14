import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, sql } from "../src/db";
import { databaseUrl } from "../src/db/env";
import { app } from "../src/app";
import {
  attempts,
  articles,
  users,
  notifications,
  attemptAnswers,
  questions,
} from "../src/db/schema";
import {
  dailyAssignments,
  dailyChallenges,
  dailyResponses,
  fireLedger,
  fireSummary,
  fireRecovery,
  rankingConfigs,
  rankingDecisions,
  rankingOverrides,
  rankingVersions,
  comments,
} from "../src/db/features";
import { createSession } from "../src/sessions";
import { publishDue } from "../src/features/cms";
import {
  calculate,
  refreshRanking,
  type Candidate,
} from "../src/features/ranking";
import {
  bangkokDay,
  addDays,
  endOfDay,
  DomainError,
} from "../src/features/common";
import {
  dailyView,
  getFire,
  submitDaily,
  recover,
  recoveryCap,
  ensureDay,
  protectByExam,
  archiveDaily,
} from "../src/features/daily";
assert.match(
  new URL(databaseUrl()).pathname,
  /^\/pipol_sow_test_[a-f0-9]{32}$/,
);
const admin = { "x-admin-key": process.env.ADMIN_API_KEY! };
let passed = 0;
const evidence: string[] = [];
function ok(name: string) {
  evidence.push(name);
  console.log(`PASS ${++passed}: ${name}`);
}
async function req(
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
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    }),
  );
}
async function j<T>(
  path: string,
  method = "GET",
  body?: unknown,
  status = 200,
  headers: Record<string, string> = admin,
): Promise<T> {
  const r = await req(path, method, body, headers);
  assert.equal(
    r.status,
    status,
    `${method} ${path}: ${await r.clone().text()}`,
  );
  return r.json() as Promise<T>;
}
async function user(
  label: string,
  staffRole: "owner" | "author" | "none" = "none",
) {
  const [u] = await db
    .insert(users)
    .values({
      googleId: label,
      email: `${label}@pipoltutor.test`,
      firstName: label,
      lastName: "ทดสอบ",
      displayName: label,
      staffRole,
    })
    .returning();
  return {
    row: u!,
    headers: { cookie: `pt_session=${(await createSession(u!.id)).token}` },
  };
}
const packInput = {
  slug: "sow-pack",
  title: "ทดสอบอันดับ",
  description: null,
  questionCount: 1,
  durationSeconds: 60,
  maxAttempts: null,
  opensAt: null,
  closesAt: null,
  published: false,
  showReview: false,
  paperUrl: null,
};
try {
  const candidate = (
    id: string,
    score: number,
    seconds: number,
    start = 0,
  ): Candidate => ({
    id,
    userId: id,
    score,
    activeSeconds: seconds,
    activeVerified: true,
    startedAt: new Date(1700000000000 + start),
    name: id,
    email: "",
    test: false,
  });
  const c = calculate([
    candidate("A", 85, 4800),
    candidate("B", 85, 4800, 3600000),
    candidate("C", 85, 4200, 3600000),
    candidate("D", 84, 1000),
  ]);
  assert.deepEqual(
    c.rows.map((r) => [r.userId, r.calculated.rank]),
    [
      ["C", 1],
      ["A", 2],
      ["B", 3],
      ["D", 4],
    ],
  );
  const tied = calculate([
    candidate("A", 85, 4800),
    candidate("B", 85, 4800),
    candidate("C", 84, 4800),
  ]);
  assert.deepEqual(
    tied.rows.map((r) => r.calculated.rank),
    [1, 1, 3],
  );
  ok("AC-11 ranking active-time/start tie-break and competition 1,1,3");
  const selected = calculate([
    candidate("A", 40, 10),
    { ...candidate("A", 70, 20), id: "second" },
    candidate("B", 40, 10),
    candidate("C", 30, 10),
    candidate("D", 50, 10),
  ]);
  assert.equal(selected.rows[0]!.attemptId, "second");
  const p = calculate([
    candidate("A", 30, 10),
    candidate("B", 40, 10),
    candidate("C", 40, 20),
    candidate("D", 50, 10),
  ]);
  assert.equal(p.rows.find((r) => r.userId === "B")!.calculated.percentile, 50);
  assert.equal(p.rows.find((r) => r.userId === "C")!.calculated.percentile, 50);
  ok("AC-12/14 selected best attempt; percentile ignores tie-break time");
  const pop = Array.from({ length: 20 }, (_, i) => candidate(String(i), i, 60));
  const a = calculate(pop, new Set(["18", "19"]));
  const b = calculate(
    pop.map((x) => (x.userId === "19" ? { ...x, score: 500 } : x)),
    new Set(["18", "19"]),
  );
  assert.equal(a.nRank, 20);
  assert.equal(a.nRef, 18);
  assert.equal(a.mean, b.mean);
  assert.equal(
    calculate([candidate("a", 5, 60), candidate("b", 5, 60)]).rows[0]!
      .calculated.z,
    0,
  );
  assert.equal(calculate([candidate("a", 5, 60)], new Set(["a"])).mean, null);
  ok("AC-15/16 separate reference population, zero SD and empty reference");
  const owner = await user("owner", "owner"),
    author = await user("author", "author"),
    student = await user("student"),
    other = await user("other");
  await j(
    "/admin/ranking/00000000-0000-4000-8000-000000000000",
    "GET",
    undefined,
    403,
    author.headers,
  );
  await j(
    "/admin/certificates/keys/list",
    "GET",
    undefined,
    403,
    author.headers,
  );
  await j(
    "/admin/cms/categories",
    "POST",
    { name: "หมวดของผู้เขียน", slug: "author-topic", kind: "topic", parentId: null, sortOrder: 0 },
    403,
    author.headers,
  );
  const authorTarget = (
    await j<{ category: { id: string } }>("/admin/cms/categories", "POST", {
      name: "หมวดเป้าหมาย",
      slug: "author-target",
      kind: "topic",
      parentId: null,
      sortOrder: 0,
    })
  ).category.id;
  await j(
    `/admin/cms/categories/${authorTarget}`,
    "PUT",
    { name: "เปลี่ยนโดยผู้เขียน", parentId: null, sortOrder: 0 },
    403,
    author.headers,
  );
  await j(`/admin/cms/categories/${authorTarget}`, "DELETE", { reason: "ผู้เขียนลบหมวด" }, 403, author.headers);
  await j(
    "/admin/cms/merge/preview",
    "POST",
    { from: authorTarget, to: authorTarget, reason: "ผู้เขียนรวมหมวด" },
    403,
    author.headers,
  );
  ok("AC-38 Author denied ranking, key management and taxonomy changes in backend");
  const { pack } = await j<{ pack: { id: string } }>(
    "/admin/packs",
    "POST",
    packInput,
    201,
  );
  const packId = pack.id;
  const [a1] = await db
    .insert(attempts)
    .values({
      userId: student.row.id,
      packId,
      status: "submitted",
      score: 40,
      maxScore: 100,
      activeSeconds: 100,
      activeVerified: true,
      startedAt: new Date("2026-01-01T00:00Z"),
      expiresAt: new Date(),
      submittedAt: new Date(),
    })
    .returning();
  assert.ok(a1);
  await refreshRanking(packId);
  const rank = await j<{ metrics: { rank: number }; nRank: number }>(
    `/attempts/${a1.id}/ranking`,
    "GET",
    undefined,
    200,
    student.headers,
  );
  assert.equal(rank.metrics.rank, 1);
  assert.equal(rank.nRank, 1);
  await j(`/attempts/${a1.id}/ranking`, "GET", undefined, 404, other.headers);
  ok("AC-01/08/STAT-08 own ranking 1/1 and other-user 404");
  // A lower second attempt is not the one ranked, but the student still sees its score.
  const [lower] = await db
    .insert(attempts)
    .values({
      userId: student.row.id,
      packId,
      status: "submitted",
      score: 30,
      maxScore: 100,
      activeSeconds: 100,
      activeVerified: true,
      startedAt: new Date("2026-01-02T00:00Z"),
      expiresAt: new Date(),
      submittedAt: new Date(),
    })
    .returning();
  await refreshRanking(packId);
  const own = (
    await j<{
      attempts: { id: string; score: number | null; selectedForRanking: boolean }[];
    }>("/attempts", "GET", undefined, 200, student.headers)
  ).attempts;
  const shown = (id: string) => {
    const a = own.find((x) => x.id === id);
    return a && { score: a.score, selected: a.selectedForRanking };
  };
  assert.deepEqual(shown(a1.id), { score: 40, selected: true });
  assert.deepEqual(shown(lower!.id), { score: 30, selected: false });
  await db.delete(attempts).where(eq(attempts.id, lower!.id));
  await refreshRanking(packId);
  ok("STAT-03 unselected attempt keeps its own score in the student's history");
  const prev = await j<{ previewId: string }>(
    `/admin/ranking/${packId}/preview`,
    "POST",
    {
      changes: [
        {
          userId: student.row.id,
          metrics: { percentile: 96.5 },
          reason: "รับรองผลทดสอบ",
        },
      ],
    },
  );
  await j(`/admin/ranking/${packId}/commit`, "POST", {
    previewId: prev.previewId,
  });
  const original = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, a1.id));
  await db.insert(attempts).values({
    userId: other.row.id,
    packId,
    status: "submitted",
    score: 80,
    maxScore: 100,
    activeSeconds: 200,
    activeVerified: true,
    expiresAt: new Date(),
    submittedAt: new Date(),
  });
  const newer = await refreshRanking(packId);
  const row = newer.snapshot.rows.find((r) => r.userId === student.row.id)!;
  assert.equal(row.official.percentile, 96.5);
  assert.ok(row.review.includes("percentile"));
  assert.equal(row.calculated.percentile, 25);
  assert.equal(newer.snapshot.rows[0]!.calculated.rank, 1);
  assert.deepEqual(
    (await db.select().from(attempts).where(eq(attempts.id, a1.id)))[0],
    original[0],
  );
  ok(
    "AC-17/18 overrides stay frozen, review flag appears, calculated auto-updates; raw attempt untouched",
  );
  const exclude = await j<{ previewId: string; after: { nRef: number } }>(
    `/admin/ranking/${packId}/preview`,
    "POST",
    {
      changes: [{ userId: other.row.id, included: false, reason: "บัญชีทดสอบ" }],
    },
  );
  assert.equal(exclude.after.nRef, 1);
  assert.equal((await refreshRanking(packId)).snapshot.nRef, 2);
  await j(`/admin/ranking/${packId}/commit`, "POST", {
    previewId: exclude.previewId,
  });
  assert.equal((await refreshRanking(packId)).snapshot.nRef, 1);
  await j(
    `/admin/ranking/${packId}/commit`,
    "POST",
    { previewId: exclude.previewId },
    409,
  );
  ok(
    "AC-13 reference exclusion changes only after preview commit; repeat commit rejected",
  );
  const form = new FormData();
  form.set(
    "file",
    new File(
      [
        `user_id,reason,percentile\n${student.row.id},ทดสอบ,90\n${student.row.id},ทดสอบ,91`,
      ],
      "duplicate.csv",
      { type: "text/csv" },
    ),
  );
  await j(`/admin/ranking/${packId}/import`, "POST", form, 422);
  ok("AC-19 duplicate import rejected atomically");
  // Roll back to a historical official snapshot, then read twice: neither read
  // may silently replace the restored result with a fresh calculation.
  const history = await db
    .select()
    .from(rankingVersions)
    .where(eq(rankingVersions.packId, packId));
  const historical = history.find(
    (v) =>
      v.snapshot.nRef === 2 &&
      v.snapshot.rows.some((r) => r.official.percentile === 96.5),
  )!;
  const changedOverride = await j<{ previewId: string }>(
    `/admin/ranking/${packId}/preview`,
    "POST",
    {
      changes: [
        {
          userId: student.row.id,
          metrics: { percentile: 70 },
          reason: "ค่าใหม่ก่อนย้อน",
        },
      ],
    },
  );
  await j(`/admin/ranking/${packId}/commit`, "POST", {
    previewId: changedOverride.previewId,
  });
  // A ranking editor without publish rights may not change publication by
  // restoring a version whose visibility differs, nor through settings.
  const readConfig = async () =>
    (
      await db
        .select()
        .from(rankingConfigs)
        .where(eq(rankingConfigs.packId, packId))
    )[0]!;
  const cfg0 = await readConfig();
  const latestBefore = (
    await db
      .select()
      .from(rankingVersions)
      .where(eq(rankingVersions.packId, packId))
  ).sort((a, b) => b.version - a.version)[0]!;
  const toggled = cfg0.visibility.includes("percentile")
    ? cfg0.visibility.filter((m) => m !== "percentile")
    : [...cfg0.visibility, "percentile"];
  const settingsBody = (cfg: typeof cfg0, visibility: string[], reason: string) => ({
    policy: cfg.policy,
    visibility,
    publishedFinal: cfg.publishedFinal,
    suspiciousSeconds: cfg.suspiciousSeconds,
    baseVersion: cfg.version,
    reason,
  });
  await j(`/admin/ranking/${packId}/settings`, "PUT", settingsBody(cfg0, toggled, "เปลี่ยนการแสดงผลทดสอบ"));
  const cfg1 = await readConfig();
  const editor = await user("ranking-editor");
  await db
    .update(users)
    .set({ staffRole: "admin", modulePermissions: { ranking: ["read", "write"] } })
    .where(eq(users.id, editor.row.id));
  await j(
    `/admin/ranking/${packId}/rollback`,
    "POST",
    { versionId: latestBefore.id, baseVersion: cfg1.version, reason: "ย้อนโดยไม่มีสิทธิ์เผยแพร่" },
    403,
    editor.headers,
  );
  await j(
    `/admin/ranking/${packId}/settings`,
    "PUT",
    settingsBody(cfg1, cfg0.visibility, "เปลี่ยนการแสดงผลโดยไม่มีสิทธิ์"),
    403,
    editor.headers,
  );
  await j(
    `/admin/ranking/${packId}/settings`,
    "PUT",
    { ...settingsBody(cfg1, cfg1.visibility, "เผยแพร่โดยไม่มีสิทธิ์"), publishedFinal: !cfg1.publishedFinal },
    403,
    editor.headers,
  );
  await j(`/admin/ranking/${packId}/settings`, "PUT", settingsBody(cfg1, cfg0.visibility, "คืนการแสดงผล"));
  const currentConfig = (
    await db
      .select()
      .from(rankingConfigs)
      .where(eq(rankingConfigs.packId, packId))
  )[0]!;
  await j(`/admin/ranking/${packId}/rollback`, "POST", {
    versionId: historical.id,
    baseVersion: currentConfig.version,
    reason: "ย้อนรุ่นตรวจรับ",
  });
  const afterRollback = await j<{ snapshot: typeof historical.snapshot }>(
    `/admin/ranking/${packId}`,
  );
  assert.equal(
    afterRollback.snapshot.rows.find((r) => r.userId === student.row.id)
      ?.official.percentile,
    96.5,
  );
  await j(`/admin/ranking/${packId}`);
  assert.ok(
    (
      await db
        .select()
        .from(rankingVersions)
        .where(eq(rankingVersions.packId, packId))
    ).length > history.length,
  );
  ok("AC-20 rollback keeps historical official values and appends provenance; publication changes by rollback or settings need publish rights");
  const hiddenConfig = (
    await db
      .select()
      .from(rankingConfigs)
      .where(eq(rankingConfigs.packId, packId))
  )[0]!;
  await j(`/admin/ranking/${packId}/settings`, "PUT", {
    policy: "best",
    visibility: ["rank"],
    publishedFinal: true,
    suspiciousSeconds: 0,
    baseVersion: hiddenConfig.version,
    reason: "ซ่อนคะแนนตามสิทธิ์เผยแพร่",
  });
  assert.equal(
    (
      await j<{ attempt: { score: number | null } }>(
        `/attempts/${a1.id}`,
        "GET",
        undefined,
        200,
        student.headers,
      )
    ).attempt.score,
    null,
  );
  const hiddenRank = await j<{ metrics: Record<string, number> }>(
    `/attempts/${a1.id}/ranking`,
    "GET",
    undefined,
    200,
    student.headers,
  );
  assert.equal("score" in hiddenRank.metrics, false);
  ok(
    "STAT-10/14 hidden published metrics cannot leak through legacy attempt API",
  );
  const content = {
    title: "ความน่าจะเป็น",
    slug: "probability",
    excerpt: "บทเรียนทดสอบ",
    coverUrl: null,
    blocks: [
      {
        type: "table",
        rows: [[{ text: "รวม", colSpan: 2 }], [{ text: "ก" }, { text: "ข" }]],
      },
      { type: "math", text: "P(A)=\\frac{1}{2}" },
    ],
    kind: "lesson",
    levels: ["m1", "m4"],
    subjects: ["math"],
    tags: ["probability"],
  };
  const { article } = await j<{ article: { id: string; revision: number } }>(
    "/admin/articles",
    "POST",
    content,
    201,
    author.headers,
  );
  await j(
    `/admin/articles/${article.id}/workflow`,
    "POST",
    { action: "publish", baseRevision: article.revision },
    403,
    author.headers,
  );
  await j(
    `/admin/articles/${article.id}/workflow`,
    "POST",
    {
      action: "schedule",
      baseRevision: article.revision,
      scheduledAt: new Date(Date.now() + 60000).toISOString(),
    },
    422,
  );
  let current = article.revision;
  for (const action of ["submit", "approve", "publish"]) {
    const r = await j<{ article: { revision: number } }>(
      `/admin/articles/${article.id}/workflow`,
      "POST",
      { action, baseRevision: current },
      200,
      action === "submit" ? author.headers : admin,
    );
    current = r.article.revision;
  }
  await j("/articles/probability", "GET", undefined, 200, {});
  const found = await j<{ articles: unknown[] }>(
    "/articles?q=" + encodeURIComponent("ความน่าจะเปน"),
    "GET",
    undefined,
    200,
    {},
  );
  assert.equal(found.articles.length, 1);
  ok(
    "AC-21/22/23 public article, Thai fuzzy search, merged table/math and enforced approval workflow",
  );
  const scheduled = await j<{ article: { id: string; revision: number } }>("/admin/articles", "POST", { ...content, slug: "scheduled-lesson", title: "บทเรียนตามเวลา" }, 201, author.headers);
  let scheduledRevision = scheduled.article.revision;
  const scheduledAt = new Date(Date.now() + 60000);
  for (const action of ["submit", "approve", "schedule"]) {
    const next = await j<{ article: { revision: number } }>(`/admin/articles/${scheduled.article.id}/workflow`, "POST", { action, baseRevision: scheduledRevision, ...(action === "schedule" ? { scheduledAt: scheduledAt.toISOString() } : {}) });
    scheduledRevision = next.article.revision;
  }
  await publishDue(new Date(scheduledAt.getTime() - 1));
  await j("/articles/scheduled-lesson", "GET", undefined, 404, {});
  await Promise.all([publishDue(scheduledAt), publishDue(scheduledAt)]);
  await j("/articles/scheduled-lesson", "GET", undefined, 200, {});
  const [autoPublished] = await db.select().from(articles).where(eq(articles.id, scheduled.article.id));
  assert.equal(autoPublished!.revision, scheduledRevision + 1);
  assert.equal(autoPublished!.publishedAt!.getTime(), scheduledAt.getTime());
  const first = await j<{ comment: { id: string; status: string } }>(
    "/articles/probability/comments",
    "POST",
    { text: "คำถามเรื่องบทเรียน" },
    200,
    student.headers,
  );
  const flagged = await j<{ comment: { id: string; status: string } }>(
    "/articles/probability/comments",
    "POST",
    { text: "สล็อต https://bad.example" },
    200,
    other.headers,
  );
  assert.equal(flagged.comment.status, "flagged_pending");
  let list = await j<{ comments: { id: string }[] }>(
    "/articles/probability/comments",
    "GET",
    undefined,
    200,
    {},
  );
  assert.equal(
    list.comments.some((c) => c.id === flagged.comment.id),
    false,
  );
  await j(`/admin/comments/${flagged.comment.id}`, "PUT", {
    action: "approve",
    reason: "ทดสอบ false positive",
  });
  list = await j("/articles/probability/comments");
  assert.ok(list.comments.some((c) => c.id === flagged.comment.id));
  await j(
    "/articles/probability/comments",
    "POST",
    { text: "ตอบคำถาม", parentId: first.comment.id },
    200,
    other.headers,
  );
  const notices = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, student.row.id));
  assert.ok(notices.some((n) => n.kind === "comment_reply"));
  ok(
    "AC-24/25 flagged comment hidden until approval; reply notification created",
  );
  const q = {
    id: randomUUID(),
    type: "single" as const,
    subject: "math" as const,
    topic: "จำนวน",
    prompt: "2+3",
    choices: [
      { key: "A", text: "4" },
      { key: "B", text: "5" },
    ],
    correctChoices: ["B"],
    acceptedAnswers: [],
    hint: "นับเพิ่ม",
    showHint: true,
    explanation: "2+3=5",
    reveal: "next_day" as const,
  };
  const today = bangkokDay();
  await db.insert(dailyChallenges).values({
    title: "โจทย์วันนี้",
    date: today,
    status: "scheduled",
    questions: [q],
  });
  const before = await dailyView(student.row.id, today);
  assert.equal("correctChoices" in before.questions[0]!, false);
  const wrong = await submitDaily(
    student.row.id,
    today,
    q.id,
    { selectedChoices: ["A"], textAnswer: null },
    randomUUID(),
  );
  assert.equal(wrong.hint, "นับเพิ่ม");
  assert.equal((await getFire(student.row.id)).todayState, "incomplete");
  const requestId = randomUUID();
  const right = await submitDaily(
    student.row.id,
    today,
    q.id,
    { selectedChoices: ["B"], textAnswer: null },
    requestId,
  );
  assert.equal(right.correct, true);
  assert.equal((await getFire(student.row.id)).current, 1);
  await assert.rejects(
    submitDaily(
      student.row.id,
      today,
      q.id,
      { selectedChoices: ["B"], textAnswer: null },
      randomUUID(),
    ),
    (e: unknown) => e instanceof DomainError && e.status === 409,
  );
  ok(
    "AC-26/28 first wrong hint, second correct increment, third refused; abandoned first wrong not protected",
  );
  await Promise.all(
    Array.from({ length: 100 }, () =>
      submitDaily(
        student.row.id,
        today,
        q.id,
        { selectedChoices: ["B"], textAnswer: null },
        requestId,
      ),
    ),
  );
  assert.equal((await getFire(student.row.id)).current, 1);
  ok("AC-30 100 concurrent retries increment only once");
  const late = new Date(`${addDays(today, 1)}T00:00:00+07:00`);
  await assert.rejects(
    submitDaily(
      other.row.id,
      today,
      q.id,
      { selectedChoices: ["B"], textAnswer: null },
      randomUUID(),
      late,
    ),
    DomainError,
  );
  ok("AC-31 midnight server cutoff rejects stale day");
  const monday = "2026-11-16",
    tuesday = "2026-11-17",
    wednesday = "2026-11-18";
  await db.insert(dailyChallenges).values({
    title: "Monday",
    date: monday,
    status: "scheduled",
    questions: [q],
  });
  await db.insert(fireSummary).values({
    userId: owner.row.id,
    current: 50,
    highest: 60,
    lastDate: monday,
  });
  const pending = await getFire(
    owner.row.id,
    new Date(`${tuesday}T12:00:00+07:00`),
  );
  assert.equal(pending.current, 50);
  assert.equal(pending.pendingDate, monday);
  await recover(owner.row.id, new Date(`${tuesday}T23:59:59+07:00`));
  assert.equal(
    (await getFire(owner.row.id, new Date(`${wednesday}T12:00:00+07:00`)))
      .highest,
    60,
  );
  assert.equal(recoveryCap(9), 3);
  assert.equal(recoveryCap(10), 4);
  assert.equal(recoveryCap(30), 5);
  assert.equal(recoveryCap(50), 6);
  const expiredRecovery = await user("expired-recovery");
  await db
    .insert(fireSummary)
    .values({
      userId: expiredRecovery.row.id,
      current: 9,
      highest: 11,
      lastDate: monday,
    });
  const expiredFire = await getFire(
    expiredRecovery.row.id,
    new Date(`${wednesday}T12:00:00+07:00`),
  );
  assert.equal(expiredFire.current, 0);
  assert.equal(expiredFire.highest, 11);
  await assert.rejects(
    recover(expiredRecovery.row.id, new Date(`${wednesday}T12:00:00+07:00`)),
    DomainError,
  );
  const tierUser = await user("quota-tier");
  await db
    .insert(fireSummary)
    .values({
      userId: tierUser.row.id,
      current: 9,
      highest: 10,
      lastDate: today,
    });
  for (let i = 1; i <= 4; i++)
    await db
      .insert(fireRecovery)
      .values({
        userId: tierUser.row.id,
        missedDate: `2026-10-${String(i).padStart(2, "0")}`,
        month: today.slice(0, 7),
        usedQuota: true,
      });
  assert.equal((await getFire(tierUser.row.id)).remaining, 0);
  await db
    .update(fireSummary)
    .set({ current: 10 })
    .where(eq(fireSummary.userId, tierUser.row.id));
  assert.equal((await getFire(tierUser.row.id)).cap, 4);
  ok("AC-32/33/34 recovery window, tier caps and highest preservation");
  const multiUser = await user("multi"),
    multiCorrect = await user("multi-correct");
  const multiDate = "2030-01-01",
    multiNow = new Date(`${multiDate}T12:00:00+07:00`);
  const multiQ = [q, { ...q, id: randomUUID() }, { ...q, id: randomUUID() }];
  await db
    .insert(dailyChallenges)
    .values({
      title: "สามข้อ",
      date: multiDate,
      status: "scheduled",
      questions: multiQ,
    });
  for (const u of [multiUser, multiCorrect]) {
    for (const item of multiQ)
      await submitDaily(
        u.row.id,
        multiDate,
        item.id,
        { selectedChoices: ["A"], textAnswer: null },
        randomUUID(),
        multiNow,
      );
    assert.equal((await getFire(u.row.id, multiNow)).todayState, "protected");
  }
  for (const item of multiQ)
    await submitDaily(
      multiCorrect.row.id,
      multiDate,
      item.id,
      { selectedChoices: ["B"], textAnswer: null },
      randomUUID(),
      multiNow,
    );
  assert.equal((await getFire(multiCorrect.row.id, multiNow)).current, 1);
  assert.equal(
    (await getFire(multiUser.row.id, new Date("2030-01-02T12:00:00+07:00")))
      .pendingDate,
    null,
  );
  ok(
    "AC-27 multi-question partial completion protects; correcting all increases once",
  );
  const noDay = await db.transaction((tx) => ensureDay(tx, "2031-01-01"));
  assert.equal(noDay.questions.length, 0);
  const fallback = (
    await db
      .insert(dailyChallenges)
      .values({
        title: "สำรอง",
        date: null,
        status: "scheduled",
        queueOrder: 1,
        questions: [q],
      })
      .returning()
  )[0]!;
  const fixed = (
    await db
      .insert(dailyChallenges)
      .values({
        title: "วันที่แน่นอน",
        date: "2031-01-02",
        status: "scheduled",
        questions: [q],
      })
      .returning()
  )[0]!;
  assert.equal(
    (await db.transaction((tx) => ensureDay(tx, "2031-01-02"))).challengeId,
    fixed.id,
  );
  assert.equal(
    (await db.transaction((tx) => ensureDay(tx, "2031-01-03"))).challengeId,
    fallback.id,
  );
  assert.equal(
    (await db.transaction((tx) => ensureDay(tx, "2031-01-04"))).questions
      .length,
    0,
  );
  ok("AC-35 fixed date wins, fallback consumed once, empty day auto-protects");
  const examUser = await user("exam-preserve");
  const bank = (
    await db
      .insert(questions)
      .values({
        subject: "math",
        topic: "จำนวน",
        prompt: "2+3",
        type: "single",
        choices: q.choices,
        correctChoices: ["B"],
      })
      .returning()
  )[0]!;
  for (const status of ["submitted", "expired"] as const) {
    const a = (
      await db
        .insert(attempts)
        .values({
          userId: examUser.row.id,
          packId,
          status,
          score: 0,
          maxScore: 1,
          expiresAt: new Date(),
          submittedAt: new Date(),
        })
        .returning()
    )[0]!;
    await db
      .insert(attemptAnswers)
      .values({ attemptId: a.id, questionId: bank.id, selectedChoices: ["A"] });
    await protectByExam(a.id);
    assert.equal(
      (await getFire(examUser.row.id)).todayState,
      "protected_by_exam",
    );
  }
  ok("AC-29 manual and automatic exam submission with an answer protects Fire");
  const challenge = (
    await db
      .select()
      .from(dailyChallenges)
      .where(eq(dailyChallenges.date, today))
  )[0]!;
  const edit = await j<{ previewId: string }>(
    `/admin/daily/${challenge.id}/preview`,
    "POST",
    {
      title: challenge.title,
      date: today,
      status: "scheduled",
      queueOrder: 0,
      questions: [{ ...q, correctChoices: ["A"] }],
      keepFire: true,
      resetTries: false,
      reason: "แก้เฉลยแต่คงไฟเดิม",
    },
  );
  await j(`/admin/daily/${challenge.id}/commit`, "POST", {
    previewId: edit.previewId,
  });
  assert.equal((await getFire(student.row.id)).current, 1);
  assert.ok(
    (
      await db
        .select()
        .from(dailyResponses)
        .where(eq(dailyResponses.userId, student.row.id))
    ).some((r) => r.verdictHistory.length),
  );
  ok(
    "AC-36 daily regrade previews effect and preserves Fire with verdict history",
  );
  // Build a real xlsx workbook; bad rows must not create even the valid row.
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook(),
    sheet = workbook.addWorksheet("Daily");
  const header = [
    "daily_date",
    "title",
    "question_key",
    "type",
    "stem",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "answer",
    "subject",
    "topic",
    "hint",
    "answer_release",
    "priority",
  ];
  sheet.addRow(header);
  sheet.addRow([
    "2032-01-01",
    "นำเข้าทดสอบ",
    "XLSX1",
    "single",
    "2+3",
    "4",
    "5",
    "6",
    "7",
    "B",
    "math",
    "จำนวน",
    "นับต่อ",
    "next_day",
    0,
  ]);
  const importForm = new FormData();
  importForm.set("reason", "นำเข้าไฟล์ทดสอบ");
  importForm.set(
    "file",
    new File([await workbook.xlsx.writeBuffer()], "daily.xlsx"),
  );
  const imported = await j<{ previewId: string }>(
    "/admin/daily/import",
    "POST",
    importForm,
  );
  await j("/admin/daily/import/commit", "POST", {
    previewId: imported.previewId,
  });
  assert.equal(
    (
      await db
        .select()
        .from(dailyChallenges)
        .where(eq(dailyChallenges.date, "2032-01-01"))
    ).length,
    1,
  );
  const malformed = new FormData();
  malformed.set("reason", "ตรวจแถวเสีย");
  malformed.set(
    "file",
    new File(
      [
        header.join(",") +
          "\n2032-01-02,valid,A,single,2+3,4,5,6,7,B,math,จำนวน,,next_day,0\n2032-01-03,broken,B,single,,,,,,,,,,,",
      ],
      "bad.csv",
    ),
  );
  await j("/admin/daily/import", "POST", malformed, 422);
  assert.equal(
    (
      await db
        .select()
        .from(dailyChallenges)
        .where(eq(dailyChallenges.date, "2032-01-02"))
    ).length,
    0,
  );
  ok("AC-37 valid XLSX commits; malformed CSV fails without partial rows");
  const missed = addDays(today, -2),
    outageUser = await user("outage");
  await db
    .insert(dailyChallenges)
    .values({
      title: "ระบบขัดข้อง",
      date: missed,
      status: "scheduled",
      questions: [q],
    });
  await db
    .insert(fireSummary)
    .values({
      userId: outageUser.row.id,
      current: 8,
      highest: 12,
      lastDate: missed,
    });
  assert.equal((await getFire(outageUser.row.id)).current, 0);
  const outage = await j<{ previewId: string }>(
    "/admin/daily/outage/preview",
    "POST",
    {
      from: missed,
      to: today,
      userIds: [outageUser.row.id],
      mode: "bulk_recover",
      reason: "คืนไฟหลังระบบขัดข้อง",
    },
  );
  await j("/admin/daily/outage/commit", "POST", {
    previewId: outage.previewId,
  });
  assert.equal((await getFire(outageUser.row.id)).current, 8);
  await j(
    "/admin/daily/outage/commit",
    "POST",
    { previewId: outage.previewId },
    409,
  );
  assert.equal((await getFire(outageUser.row.id)).current, 8);
  ok(
    "FIRE-12 outage recovery restores lost Current once without consuming quota",
  );
  {
    const extUser = await user("extend"),
      otherUser = await user("not-extended"),
      close = endOfDay(today).getTime(),
      iso = (ms: number) => new Date(ms).toISOString(),
      closed = (e: unknown) => e instanceof DomainError && e.status === 409,
      anyAnswer = { selectedChoices: ["B"], textAnswer: null };
    const extendBody = (extra: Record<string, unknown>) => ({
      from: today,
      to: today,
      userIds: [extUser.row.id],
      mode: "extend",
      reason: "ระบบขัดข้องช่วงก่อนเที่ยงคืน",
      until: iso(close + 2 * 3600000),
      ...extra,
    });
    // After midnight the key is revealed and archived, so only today extends.
    const yesterday = addDays(today, -1);
    await j("/admin/daily/outage/preview", "POST", extendBody({ from: yesterday, to: yesterday }), 422);
    await j("/admin/daily/outage/preview", "POST", extendBody({ until: iso(close + 25 * 3600000) }), 422);
    await j("/admin/daily/outage/preview", "POST", extendBody({ until: iso(close - 60000) }), 422);
    const plan = await j<{ previewId: string; everyone: boolean; until: string; affected: number }>(
      "/admin/daily/outage/preview",
      "POST",
      extendBody({}),
    );
    assert.equal(plan.everyone, false);
    assert.equal(plan.affected, 1);
    await j("/admin/daily/outage/commit", "POST", { previewId: plan.previewId });
    await j("/admin/daily/outage/commit", "POST", { previewId: plan.previewId }, 409);
    const inWindow = new Date(close + 30 * 60000),
      after = new Date(close + 3 * 3600000);
    // A learner outside the approved population keeps the normal cutoff.
    await assert.rejects(
      submitDaily(otherUser.row.id, today, q.id, anyAnswer, randomUUID(), inWindow),
      closed,
    );
    // Nobody sees the key while the extension is open; the day is not archived.
    const held = await dailyView(extUser.row.id, today, inWindow);
    assert.equal(held.archive, false);
    assert.equal(held.extendedUntil, plan.until);
    assert.equal(held.questions[0]!.correctChoices, undefined);
    assert.equal((await dailyView(null, today, inWindow)).questions[0]!.correctChoices, undefined);
    await archiveDaily(inWindow);
    const [assignment] = await db
      .select()
      .from(dailyAssignments)
      .where(eq(dailyAssignments.date, today));
    assert.equal(assignment!.archivedQuestionIds, null);
    // Earlier regrade checks may have changed today's key; derive it from the snapshot.
    const key = assignment!.questions.find((x) => x.id === q.id)!.correctChoices,
      right = { selectedChoices: key, textAnswer: null },
      wrong = {
        selectedChoices: [q.choices.find((c) => !key.includes(c.key))!.key],
        textAnswer: null,
      };
    // Answers inside the window count for the extended day, once.
    const before = (await getFire(extUser.row.id, inWindow)).current;
    assert.equal((await submitDaily(extUser.row.id, today, q.id, wrong, randomUUID(), inWindow)).correct, false);
    const id = randomUUID();
    assert.equal((await submitDaily(extUser.row.id, today, q.id, right, id, inWindow)).correct, true);
    assert.equal((await submitDaily(extUser.row.id, today, q.id, right, id, inWindow)).duplicate, true);
    assert.equal((await getFire(extUser.row.id, inWindow)).current, before + 1);
    const [event] = await db
      .select()
      .from(fireLedger)
      .where(and(eq(fireLedger.userId, extUser.row.id), eq(fireLedger.date, today)));
    assert.equal(event!.state, "increased");
    assert.equal(event!.increment, 1);
    // After the window: closed for everyone, key revealed, archive copied.
    await assert.rejects(
      submitDaily(otherUser.row.id, today, q.id, anyAnswer, randomUUID(), after),
      closed,
    );
    assert.deepEqual((await dailyView(null, today, after)).questions[0]!.correctChoices, key);
    await archiveDaily(after);
    const [archived] = await db
      .select()
      .from(dailyAssignments)
      .where(eq(dailyAssignments.date, today));
    assert.ok(archived!.archivedQuestionIds?.length);
    assert.equal((await getFire(extUser.row.id, after)).current, before + 1);
  }
  ok(
    "FIRE-12 extend keeps today's challenge open only for the approved population; key and archive wait; Fire counts once",
  );
  await j(
    "/admin/articles",
    "POST",
    {
      ...content,
      slug: "unsafe",
      blocks: [{ type: "button", text: "bad", href: "javascript:alert(1)" }],
    },
    422,
  );
  await j(
    "/daily/submit",
    "POST",
    {
      date: today,
      questionId: q.id,
      answer: { selectedChoices: ["B"], textAnswer: null },
      requestId: randomUUID(),
    },
    403,
    { ...student.headers, origin: "https://foreign.invalid" },
  );
  ok("SECURITY unsafe content URL and cross-origin writes blocked");
  await j(
    `/admin/users/${author.row.id}/permissions`,
    "PUT",
    { staffRole: "none", modulePermissions: {}, reason: "ถอนสิทธิ์ทดสอบ" },
    200,
    owner.headers,
  );
  await j("/admin/articles", "GET", undefined, 403, author.headers);
  ok("AC-38 role revocation takes effect on the next existing-session request");
  await j(
    "/profile/delete",
    "POST",
    { certificatePolicy: "revoke", consent: true, confirmation: "ลบบัญชีของฉัน" },
    200,
    student.headers,
  );
  await j("/daily/fire", "GET", undefined, 401, student.headers);
  ok(
    "CERT-15 account deletion records policy, anonymises profile and revokes sessions",
  );
  ok("AC-23 scheduled publisher exposes approved content exactly when due; concurrent workers append one revision");
  await Bun.write(
    "../../manuals/sow-test-result.json",
    JSON.stringify(
      { date: new Date().toISOString(), passed, checks: evidence },
      null,
      2,
    ) + "\n",
  );
  console.log(`SoW integration: ${passed} checks passed.`);
} finally {
  await sql.end();
}
