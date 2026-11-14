/** Disposable, loopback-only UI fixtures; never wired into src/app.ts. */
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { db } from "../src/db";
import { databaseUrl } from "../src/db/env";
import { app } from "../src/app";
import { users, articles, attempts, examPacks } from "../src/db/schema";
import { attemptActivityStreams, dailyChallenges, fireSummary } from "../src/db/features";
import { bangkokDay } from "../src/features/common";
import { createSession } from "../src/sessions";
import { refreshRanking } from "../src/features/ranking";
assert.match(
  new URL(databaseUrl()).pathname,
  /^\/pipol_sow_test_[a-f0-9]{32}$/,
);
const owner = (
  await db
    .insert(users)
    .values({
      googleId: "qa-owner",
      email: "qa-owner@pipoltutor.test",
      firstName: "ผู้ดูแล",
      lastName: "ทดสอบ",
      nickname: "ทดสอบ",
      staffRole: "owner",
    })
    .returning()
)[0]!;
const student = (
  await db
    .insert(users)
    .values({
      googleId: "qa-student",
      email: "qa-student@pipoltutor.test",
      firstName: "นักเรียน",
      lastName: "ทดสอบ",
      campus: "chiang_rai",
    })
    .returning()
)[0]!;
const ownerToken = (await createSession(owner.id)).token,
  studentToken = (await createSession(student.id)).token;
const article = (
  await db
    .insert(articles)
    .values({
      title: "ความน่าจะเป็น: จากโจทย์ง่ายสู่การคิดเป็นระบบ",
      slug: "probability",
      excerpt: "ฝึกแยกเหตุการณ์และหาผลลัพธ์ที่เป็นไปได้ พร้อมตัวอย่างสำหรับ ม.1 และ ม.4",
      published: true,
      publishedAt: new Date(),
      workflow: "published",
      kind: "lesson",
      levels: ["m1", "m4"],
      subjects: ["math"],
      blocks: [
        { type: "heading", text: "เริ่มจากเหตุการณ์ที่เรารู้จัก" },
        {
          type: "text",
          text: "การโยนเหรียญหนึ่งครั้งมีผลลัพธ์สองแบบ ลองใช้ตารางช่วยจัดกลุ่มก่อนคำนวณ",
        },
        { type: "math", text: "P(A)=\\frac{n(A)}{n(S)}" },
        {
          type: "table",
          rows: [
            [{ text: "ผลลัพธ์ทั้งหมด", colSpan: 2 }],
            [{ text: "หัว" }, { text: "ก้อย" }],
          ],
        },
      ],
    })
    .returning()
)[0]!;
await db
  .update(articles)
  .set({ publishedSnapshot: article })
  .where((await import("drizzle-orm")).eq(articles.id, article.id));
await db.insert(dailyChallenges).values({
  title: "ทบทวนความน่าจะเป็นไปด้วยกัน",
  date: bangkokDay(),
  status: "scheduled",
  questions: [
    {
      id: "qa-q1",
      type: "single",
      subject: "math",
      topic: "ความน่าจะเป็น",
      prompt: "โยนเหรียญหนึ่งครั้ง โอกาสออกหัวเท่ากับเท่าไร",
      choices: [
        { key: "A", text: "1/2" },
        { key: "B", text: "1/4" },
      ],
      correctChoices: ["A"],
      acceptedAnswers: [],
      hint: "เหรียญมีสองด้าน",
      showHint: true,
      explanation: "มีสองผลลัพธ์ที่มีโอกาสเท่ากัน",
      reveal: "finished",
    },
  ],
});
await db
  .insert(fireSummary)
  .values({
    userId: student.id,
    current: 16,
    highest: 24,
    lastDate: bangkokDay(),
  });
const pack = (
  await db
    .insert(examPacks)
    .values({
      slug: "qa-math",
      title: "คณิตศาสตร์ ม.1 ชุดทบทวน",
      questionCount: 1,
      durationSeconds: 3600,
      published: true,
    })
    .returning()
)[0]!;
const attempt = (
  await db
    .insert(attempts)
    .values({
      packId: pack.id,
      userId: student.id,
      status: "submitted",
      score: 85,
      maxScore: 100,
      activeSeconds: 1200,
      activeVerified: false,
      startedAt: new Date(Date.now() - 2100000),
      submittedAt: new Date(),
      expiresAt: new Date(Date.now() + 1500000),
    })
    .returning()
)[0]!;
await db.insert(attemptActivityStreams).values({
  attemptId: attempt.id,
  clientId: crypto.randomUUID(),
  startedAt: new Date(Date.now() - 2090000),
  sequence: 2,
  elapsedMs: 2000000,
  activeMs: 1800000,
  offlineMs: 600000,
  checkpoints: [
    { sequence: 1, elapsedMs: 1000000, activeMs: 900000, offlineMs: 200000, receivedAt: new Date(Date.now() - 1000000).toISOString() },
    { sequence: 2, elapsedMs: 2000000, activeMs: 1800000, offlineMs: 600000, receivedAt: new Date().toISOString() },
  ],
});
await refreshRanking(pack.id);
const secondPack=(await db.insert(examPacks).values({slug:"qa-science",title:"วิทยาศาสตร์ ม.4 ชุดทบทวน",questionCount:1,durationSeconds:3600,published:true}).returning())[0]!;
await db.insert(attempts).values({packId:secondPack.id,userId:student.id,status:"submitted",score:30,maxScore:100,activeSeconds:1600,activeVerified:true,submittedAt:new Date(),expiresAt:new Date()});
await refreshRanking(secondPack.id);
app.listen({ hostname: "127.0.0.1", port: 3012 });
const out = resolve("../../frontend/admin/out");
Bun.serve({
  hostname: "127.0.0.1",
  port: 3003,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/__qa/owner" || url.pathname === "/__qa/student")
      return new Response(null, {
        status: 302,
        headers: {
          "set-cookie": `pt_session=${url.pathname.endsWith("owner") ? ownerToken : studentToken}; Path=/; HttpOnly; SameSite=Lax`,
          location: url.pathname.endsWith("owner")
            ? "/admin/"
            : "http://127.0.0.1:3004/daily",
        },
      });
    if (url.pathname.startsWith("/api/")) {
      url.pathname = url.pathname.slice(4);
      return app.handle(new Request(url, request));
    }
    if (!url.pathname.startsWith("/admin"))
      return new Response("Not found", { status: 404 });
    let path = decodeURIComponent(url.pathname.slice(6));
    if (path.includes("..")) return new Response("Not found", { status: 404 });
    if (path.endsWith("/") || !path) path += "index.html";
    const file = Bun.file(join(out, path));
    return (await file.exists())
      ? new Response(file)
      : new Response("Not found", { status: 404 });
  },
});
console.log(
  `Disposable QA ready: http://127.0.0.1:3003/__qa/owner and /__qa/student; result http://127.0.0.1:3004/exam/result?attempt=${attempt.id}`,
);
await new Promise(() => {});
