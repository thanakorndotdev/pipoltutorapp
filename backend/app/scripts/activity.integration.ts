import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { databaseUrl } from "../src/db/env";
import { attempts, auditLogs, examPacks, users } from "../src/db/schema";
import { attemptActivityStreams } from "../src/db/features";
import { app } from "../src/app";
import { createSession } from "../src/sessions";
import { openActivity, recordActivity } from "../src/features/exam-activity";
import { checkpoint } from "../src/features/active-time";
import { DomainError } from "../src/features/common";
import { refreshRanking } from "../src/features/ranking";
import { ActivityClock, acknowledgeActivity, pendingActivities, replayActivities, storeActivity } from "../../../frontend/pipoltutor-app/lib/activity-journal";

assert.match(new URL(databaseUrl()).pathname, /^\/pipol_sow_test_[a-f0-9]{32}$/);
const checks: string[] = [];
const pass = (name: string) => { checks.push(name); console.log(`PASS ${checks.length}: ${name}`); };
const admin = { "x-admin-key": process.env.ADMIN_API_KEY! };
async function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = admin, status = 200) {
  const response = await app.handle(new Request(`http://localhost${path}`, { method, headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
  return response.json();
}
async function person(label: string, staffRole: "none" | "results_viewer" | "author" = "none") {
  const [row] = await db.insert(users).values({ googleId: randomUUID(), email: `${label}@pipoltutor.test`, staffRole }).returning();
  return { id: row!.id, headers: { cookie: `pt_session=${(await createSession(row!.id)).token}` } };
}
const rejected = (action: () => Promise<unknown>, status: number) => assert.rejects(action, (e: unknown) => e instanceof DomainError && e.status === status);

try {
  const clock = new ActivityClock(0, true, false);
  clock.sample(1000); clock.sample(2000, true, true); clock.sample(4000, false, true);
  clock.sample(5000, true, false); clock.sample(15000); clock.sample(16000);
  assert.deepEqual(clock.counters, { elapsedMs: 16000, activeMs: 5000, offlineMs: 2000 });
  pass("Monotonic activity clock excludes hidden/suspended gaps and records observed offline work only");
  const student = await person("student"), other = await person("other"), viewer = await person("viewer", "results_viewer"), author = await person("author", "author");
  const [pack] = await db.insert(examPacks).values({ slug: randomUUID(), title: "เวลาออฟไลน์", questionCount: 1, durationSeconds: 300 }).returning();
  const now = new Date(), at = (offset: number) => new Date(now.getTime() + offset * 1000);
  const [attempt] = await db.insert(attempts).values({ userId: student.id, packId: pack!.id, startedAt: at(-120), expiresAt: at(180), activeSeconds: 10, activeVerified: true, activeCheckpointAt: at(-110) }).returning();
  const aid = attempt!.id, pid = pack!.id;
  const { stream } = await openActivity(student.id, aid, randomUUID(), at(-110));
  const same = await openActivity(student.id, aid, stream.clientId, at(-109));
  assert.equal(same.stream!.id, stream.id);
  const report = { sequence: 1, elapsedMs: 40000, activeMs: 35000, offlineMs: 15000 };
  await recordActivity(student.id, aid, stream.id, report, at(-60));
  assert.equal((await recordActivity(student.id, aid, stream.id, report, at(-59))).duplicate, true);
  await rejected(() => recordActivity(student.id, aid, stream.id, { ...report, activeMs: 36000 }, at(-59)), 409);
  await rejected(() => recordActivity(student.id, aid, stream.id, { ...report, sequence: 3 }, at(-59)), 409);
  await rejected(() => recordActivity(student.id, aid, stream.id, { sequence: 2, elapsedMs: 40001, activeMs: 36000, offlineMs: 16000 }, at(-59)), 422);
  const [unverified] = await db.select().from(attempts).where(eq(attempts.id, aid));
  assert.equal(unverified!.activeVerified, false);
  assert.equal(unverified!.activeSeconds, 10);
  pass("Offline evidence is idempotent, monotonic and never silently added to trusted ranking duration");
  await request(`/attempts/${aid}/activity/streams`, "POST", { clientId: randomUUID() }, {}, 401);
  await request(`/attempts/${aid}/activity/streams`, "POST", { clientId: randomUUID() }, other.headers, 404);
  await request(`/attempts/${aid}/activity/${stream.id}`, "PUT", report, other.headers, 404);
  await request(`/attempts/${aid}/activity/${stream.id}`, "PUT", { ...report, elapsedMs: -1 }, student.headers, 422);
  await request(`/admin/ranking/${pid}/activity/${aid}`, "GET", undefined, author.headers, 403);
  await request(`/admin/ranking/${pid}/time/preview`, "POST", { attemptId: aid, activeSeconds: 30, reason: "ทดสอบ" }, viewer.headers, 403);
  await request(`/admin/ranking/${pid}/time/preview`, "POST", { attemptId: aid, activeSeconds: 30, reason: "ทดสอบ" }, admin, 409);
  pass("Mounted activity APIs enforce ownership, schemas, ranking permissions and finished-attempt review");
  await db.update(attempts).set({ status: "submitted", score: 85, maxScore: 100, submittedAt: at(-60) }).where(eq(attempts.id, aid));
  // A received-late report may describe pre-submit work, never post-submit time.
  await rejected(() => recordActivity(student.id, aid, stream.id, { sequence: 2, elapsedMs: 80000, activeMs: 70000, offlineMs: 40000 }, now), 422);
  await request(`/admin/ranking/${pid}/time/preview`, "POST", { attemptId: aid, activeSeconds: 90, reason: "เกินเวลาที่ส่งสอบ" }, admin, 422);
  pass("Late evidence and manual review are capped at server-recorded submission time");
  const secondReport = { sequence: 2, elapsedMs: 45000, activeMs: 40000, offlineMs: 20000 };
  const stale = await request(`/admin/ranking/${pid}/time/preview`, "POST", { attemptId: aid, activeSeconds: 40, reason: "ตรวจหลักฐานเวลาออฟไลน์" });
  await recordActivity(student.id, aid, stream.id, secondReport, now);
  await request(`/admin/ranking/${pid}/time`, "PUT", { previewId: stale.previewId }, admin, 409);
  const current = await request(`/admin/ranking/${pid}/time/preview`, "POST", { attemptId: aid, activeSeconds: 40, reason: "ตรวจหลักฐานเวลาออฟไลน์" });
  const raw = await db.select().from(attempts).where(eq(attempts.id, aid));
  const responses = await Promise.all([0, 1].map(async () => {
    const r = await app.handle(new Request(`http://localhost/admin/ranking/${pid}/time`, { method: "PUT", headers: { ...admin, "content-type": "application/json" }, body: JSON.stringify({ previewId: current.previewId }) }));
    return r.status;
  }));
  assert.deepEqual(responses.sort(), [200, 409]);
  const [reviewed] = await db.select().from(attempts).where(eq(attempts.id, aid));
  assert.equal(reviewed!.activeSeconds, 40); assert.equal(reviewed!.activeVerified, true); assert.ok(reviewed!.activeReviewedAt);
  assert.equal(reviewed!.score, raw[0]!.score); assert.equal(reviewed!.submittedAt!.getTime(), raw[0]!.submittedAt!.getTime());
  await rejected(() => recordActivity(student.id, aid, stream.id, { sequence: 3, elapsedMs: 46000, activeMs: 41000, offlineMs: 21000 }, now), 409);
  const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "ranking.time_review"), eq(auditLogs.targetId, aid)));
  assert.equal(logs.length, 1); assert.equal(logs[0]!.sourceId, current.previewId); assert.equal(logs[0]!.reason, "ตรวจหลักฐานเวลาออฟไลน์");
  pass("Stale preview rejected; concurrent review commits once, audits provenance and freezes reviewed evidence");
  await db.insert(attempts).values({ userId: other.id, packId: pid, status: "submitted", score: 85, maxScore: 100, activeSeconds: 45, activeVerified: true, startedAt: at(-130), expiresAt: at(170), submittedAt: at(-60) });
  const ranked = await refreshRanking(pid);
  assert.equal(ranked.snapshot.rows[0]!.attemptId, aid); assert.equal(ranked.snapshot.rows[0]!.calculated.rank, 1);
  assert.equal(ranked.snapshot.rows[0]!.flags.includes("unverified_time"), false);
  const resultPage = await request(`/attempts/${aid}`, "GET", undefined, student.headers);
  assert.equal(resultPage.attempt.activeSeconds, 40);
  assert.equal(resultPage.attempt.activeVerified, true);
  pass("STAT-05 reviewed cumulative offline time participates in actual ranking tie-break");
  const [live] = await db.insert(attempts).values({ userId: student.id, packId: pid, startedAt: at(-30), expiresAt: at(270), activeSeconds: 0, activeVerified: true, activeCheckpointAt: at(-10) }).returning();
  await db.transaction(async tx => { await checkpoint(tx, live!.id, at(-9.5)); await checkpoint(tx, live!.id, at(-9)); });
  const [precise] = await db.select().from(attempts).where(eq(attempts.id, live!.id));
  assert.equal(precise!.activeSeconds, 1); assert.equal(precise!.activeRemainderMs, 0);
  await openActivity(student.id, live!.id, randomUUID(), at(-8));
  await openActivity(student.id, live!.id, randomUUID(), at(-7));
  const [multi] = await db.select().from(attempts).where(eq(attempts.id, live!.id));
  assert.equal(multi!.activeVerified, false);
  await db.transaction(tx => checkpoint(tx, live!.id, at(30)));
  const [gap] = await db.select().from(attempts).where(eq(attempts.id, live!.id));
  assert.equal(gap!.activeSeconds, 1);
  pass("Subsecond online checkpoints accumulate; extra streams and unobserved gaps require review immediately");
  // Exercise the browser's duration-only outbox against the mounted API. The
  // failed requests and sampling during delivery reproduce reload/network races.
  const originalFetch = globalThis.fetch;
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage: Record<string, unknown> = {};
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => storage[key] ?? null },
    setItem: { value: (key: string, value: string) => { storage[key] = value; } },
    removeItem: { value: (key: string) => { delete storage[key]; } },
  });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    const browserStream = await openActivity(student.id, live!.id, randomUUID(), at(-6));
    const outbox = { attemptId: live!.id, streamId: browserStream.stream!.id, sequence: 1, elapsedMs: 1000, activeMs: 1000, offlineMs: 500 };
    storeActivity(outbox, { elapsedMs: 3000, activeMs: 3000, offlineMs: 1500 });
    let calls = 0;
    globalThis.fetch = (async (input, init) => {
      calls++;
      if (calls === 1 || calls === 3) return new Response("unavailable", { status: 503 });
      return app.handle(new Request(`http://localhost${String(input).replace(/^\/api/, "")}`, { ...init, headers: { ...student.headers, "content-type": "application/json" } }));
    }) as typeof fetch;
    await replayActivities(live!.id);
    assert.equal(pendingActivities(live!.id)[0]!.sequence, 1);
    await Promise.all([replayActivities(live!.id), replayActivities(live!.id)]);
    assert.equal(calls, 3);
    assert.equal(pendingActivities(live!.id)[0]!.sequence, 2);
    assert.equal(pendingActivities(live!.id)[0]!.offlineMs, 1500);
    await replayActivities(live!.id);
    assert.equal(pendingActivities(live!.id).length, 0);
    const [saved] = await db.select().from(attemptActivityStreams).where(eq(attemptActivityStreams.id, outbox.streamId));
    assert.equal(saved!.sequence, 2); assert.equal(saved!.offlineMs, 1500);
    // An acknowledgement must pick up samples taken while fetch was in flight.
    storeActivity(outbox);
    storeActivity(outbox, { elapsedMs: 4000, activeMs: 3500, offlineMs: 2000 });
    assert.equal(acknowledgeActivity(outbox)!.activeMs, 3500);
    globalThis.fetch = (async () => new Response("login required", { status: 401 })) as unknown as typeof fetch;
    await replayActivities(live!.id);
    assert.equal(pendingActivities(live!.id)[0]!.sequence, 2);
    // Malformed local samples cannot be promoted into successor checkpoints.
    storeActivity(outbox, { elapsedMs: 4000, activeMs: 5000, offlineMs: 2000 });
    assert.equal(acknowledgeActivity(outbox), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
  pass("Browser outbox survives reload, failed successor delivery and temporary logout; concurrent replays deduplicate");
  const streams = await db.select().from(attemptActivityStreams).where(eq(attemptActivityStreams.attemptId, aid));
  assert.equal(streams[0]!.checkpoints.length, 2);
  await Bun.write("../../manuals/activity-test-result.json", JSON.stringify({ date: new Date().toISOString(), passed: checks.length, checks }, null, 2) + "\n");
} finally { await sql.end(); }
