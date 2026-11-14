import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql as dsql } from "drizzle-orm";
import { db, sql } from "../src/db";
import { databaseUrl } from "../src/db/env";
import {
  users,
  examPacks,
  attempts,
  questions,
  packQuestions,
  attemptAnswers,
  articles,
  certificates,
  certificateJobs,
} from "../src/db/schema";
import { dailyChallenges } from "../src/db/features";
import { bangkokDay } from "../src/features/common";
import { app } from "../src/app";
import { createSession } from "../src/sessions";
import { refreshRanking } from "../src/features/ranking";
import { reconcileAttempt } from "../src/certificates/issue";
import { kickCertificateWorker } from "../src/certificates/worker";
assert.match(
  new URL(databaseUrl()).pathname,
  /^\/pipol_sow_test_[a-f0-9]{32}$/,
);
const N = 500,
  iterations = Number(process.env.LOAD_ITERATIONS ?? 10),
  rows = await db
    .insert(users)
    .values(
      Array.from({ length: N }, (_, i) => ({
        googleId: `load-${i}`,
        email: `load-${i}@pipoltutor.test`,
        firstName: `Load ${i}`,
        lastName: "Synthetic",
        displayName: `Synthetic ${i}`,
        staffRole: i >= 475 ? ("admin" as const) : ("none" as const),
      })),
    )
    .returning();
const sessions = await Promise.all(rows.map((u) => createSession(u.id)));
const packs = await db
  .insert(examPacks)
  .values([
    { slug: "load-rank", title: "Load fixture", durationSeconds: 600 },
    {
      slug: "load-cert",
      title: "Load certificate fixture",
      durationSeconds: 600,
      certificateEnabled: true,
    },
  ])
  .returning();
const [q] = await db
  .insert(questions)
  .values({
    subject: "math",
    topic: "load",
    prompt: "2+3",
    type: "single",
    points: 100,
    choices: [
      { key: "A", text: "5" },
      { key: "B", text: "4" },
    ],
    correctChoices: ["A"],
    acceptedAnswers: [],
  })
  .returning();
for (const p of packs)
  await db
    .insert(packQuestions)
    .values({ packId: p.id, questionId: q!.id, position: 1 });
const entries = await db
  .insert(attempts)
  .values(
    rows.map((u, i) => ({
      userId: u.id,
      packId: i >= 400 && i < 450 ? packs[1]!.id : packs[0]!.id,
      status:
        i >= 375 && i < 425 ? ("in_progress" as const) : ("submitted" as const),
      score: i >= 375 && i < 425 ? null : i % 101,
      maxScore: 100,
      activeSeconds: 100,
      activeVerified: true,
      activeCheckpointAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
      submittedAt: i >= 375 && i < 425 ? null : new Date(),
      studentFirstName: u.firstName,
      studentLastName: u.lastName,
      studentEmail: u.email,
    })),
  )
  .returning();
for (const a of entries.slice(375, 425))
  await db.insert(attemptAnswers).values({
    attemptId: a.id,
    questionId: q!.id,
    selectedChoices: ["A"],
    state: "answered",
  });
for (const p of packs) await refreshRanking(p.id);
await db.insert(articles).values({
  slug: "load-article",
  title: "บทเรียนทดสอบโหลด",
  excerpt: "Synthetic load fixture",
  blocks: [{ type: "text", text: "ความน่าจะเป็นสำหรับการทดสอบระบบ" }],
  published: true,
  workflow: "published",
  publishedAt: new Date(),
});
const day = bangkokDay(),
  questionId = randomUUID();
await db.insert(dailyChallenges).values({
  title: "Synthetic daily",
  date: day,
  status: "scheduled",
  questions: [
    {
      id: questionId,
      type: "single",
      subject: "math",
      topic: "load",
      prompt: "2+3",
      choices: [
        { key: "A", text: "5" },
        { key: "B", text: "4" },
      ],
      correctChoices: ["A"],
      acceptedAnswers: [],
      hint: "",
      showHint: false,
      explanation: "5",
      reveal: "next_day",
    },
  ],
});
await Promise.all(entries.slice(425, 450).map((a) => reconcileAttempt(a.id)));
await kickCertificateWorker();
const certs = await db.select().from(certificates);
assert.equal(certs.filter((c) => c.status === "valid").length, 25);
app.listen({ port: 0, hostname: "127.0.0.1" });
const origin = `http://127.0.0.1:${app.server!.port}`;
const failures: { scenario: string; status: number; error: string }[] = [];
let serverPeak = 0;
const serverSample = setInterval(() => {
  serverPeak = Math.max(serverPeak, app.server!.pendingRequests);
}, 5);
let active = 0,
  peak = 0;
const measurements: { scenario: string; ms: number; status: number }[] = [];
async function hit(
  i: number,
  scenario: string,
  path: string,
  method = "GET",
  body?: unknown,
) {
  active++;
  peak = Math.max(peak, active);
  const start = performance.now();
  let status = 0;
  try {
    const r = await fetch(origin + path, {
      method,
      headers: {
        cookie: `pt_session=${sessions[i]!.token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    });
    status = r.status;
    if (status >= 400)
      failures.push({
        scenario,
        status,
        error: (await r.clone().text()).slice(0, 150),
      });
    await r.arrayBuffer();
  } catch (error) {
    status = 0;
    failures.push({
      scenario,
      status,
      error: error instanceof Error ? error.message : "network error",
    });
  } finally {
    measurements.push({ scenario, ms: performance.now() - start, status });
    active--;
  }
}
const start = performance.now();
await Promise.all(
  rows.map(async (_u, i) => {
    for (let round = 0; round < iterations; round++) {
      if (round === 0) await hit(i, "session_read", "/auth/me");
      if (i < 150) await hit(i, "article_read", "/articles/load-article");
      else if (i < 225)
        await hit(
          i,
          "article_search",
          "/articles?q=" + encodeURIComponent("ความน่าจะเปน"),
        );
      else if (i < 300) {
        if (round === 0)
          await hit(i, "daily_submit", "/daily/submit", "POST", {
            date: day,
            questionId,
            answer: { selectedChoices: ["A"], textAnswer: null },
            requestId: randomUUID(),
          });
        else await hit(i, "daily_read", "/daily/today");
      } else if (i < 375)
        await hit(i, "rank_read", `/attempts/${entries[i]!.id}/ranking`);
      else if (i < 425) {
        if (round === 0)
          await hit(
            i,
            "exam_submit",
            `/attempts/${entries[i]!.id}/submit`,
            "POST",
          );
        else await hit(i, "exam_result", `/attempts/${entries[i]!.id}`);
      } else if (i < 450) {
        const cert = certs.find((c) => c.userId === rows[i]!.id)!;
        await hit(
          i,
          "certificate_download",
          `/certificates/${cert.id}/file?format=pdf`,
        );
      } else if (i < 475)
        await hit(
          i,
          "certificate_verify",
          `/cert/${certs[(i - 450) % certs.length]!.publicId}`,
        );
      else
        await hit(
          i,
          "admin_preview",
          `/admin/ranking/${packs[0]!.id}/preview`,
          "POST",
          {
            changes: [
              {
                userId: rows[0]!.id,
                included: true,
                reason: "Synthetic load preview",
              },
            ],
          },
        );
      await Bun.sleep(100);
    }
  }),
);
const elapsed = (performance.now() - start) / 1000,
  queueStart = performance.now();
for (let n = 0; n < 1200; n++) {
  await kickCertificateWorker();
  const jobs = await db.select().from(certificateJobs);
  if (jobs.every((j) => j.status === "done")) break;
  await Bun.sleep(50);
}
const percentile = (a: number[], p: number) =>
  a.length
    ? [...a].sort((x, y) => x - y)[
        Math.min(a.length - 1, Math.floor(a.length * p))
      ]!
    : 0;
const summary = (all: typeof measurements) => ({
  requests: all.length,
  errors: all.filter((m) => m.status < 200 || m.status >= 400).length,
  p50Ms: Math.round(
    percentile(
      all.map((m) => m.ms),
      0.5,
    ),
  ),
  p95Ms: Math.round(
    percentile(
      all.map((m) => m.ms),
      0.95,
    ),
  ),
  p99Ms: Math.round(
    percentile(
      all.map((m) => m.ms),
      0.99,
    ),
  ),
});
const report = {
  date: new Date().toISOString(),
  environment: `local ${process.platform}/${process.arch} Bun ${Bun.version}; synthetic isolated data; HTTP loopback`,
  virtualUsers: N,
  peakConcurrentHttp: peak,
  serverPendingPeak: serverPeak,
  failureSamples: failures.slice(0, 20),
  iterations,
  elapsedSeconds: Number(elapsed.toFixed(2)),
  requestsPerSecond: Number((measurements.length / elapsed).toFixed(2)),
  ...summary(measurements),
  scenarios: Object.fromEntries(
    [...new Set(measurements.map((m) => m.scenario))].map((s) => [
      s,
      summary(measurements.filter((m) => m.scenario === s)),
    ]),
  ),
  certificateJobs: await db
    .select({ status: certificateJobs.status, n: dsql<number>`count(*)::int` })
    .from(certificateJobs)
    .groupBy(certificateJobs.status),
  queueDrainSeconds: Number(
    ((performance.now() - queueStart) / 1000).toFixed(2),
  ),
  limits: [
    "Local evidence, not a production hosting capacity guarantee",
    "Google OAuth provider roundtrip excluded; real server session validation exercised",
    "A mixed profile, not 500 simultaneous certificate renders",
    "No Owner-approved production SLA or sustained external-network test yet",
  ],
};
await Bun.write(
  "../../manuals/load-500-result.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
clearInterval(serverSample);
app.server!.stop(true);
await sql.end();
assert.equal(peak, 500);
assert.equal(report.errors, 0);
