import { activityEnd, activityEvidence } from "../../features/exam-activity";
import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { attempts, examPacks } from "../../db/schema";
import {
  rankingConfigs,
  rankingDecisions,
  rankingOverrides,
  rankingVersions,
  type Metric,
  type RankingSnapshot,
} from "../../db/features";
import { authorize } from "../../permissions";
import { actorOf } from "../../audit";
import {
  auditTx,
  consumePreview,
  fail,
  lock,
  preview,
} from "../../features/common";
import {
  calculateTx,
  METRICS,
  refreshRanking,
  saveRanking,
} from "../../features/ranking";
import { csv, readSheet } from "../../features/spreadsheet";
import { adminGuard } from "./guard";

const params = t.Object({ id: t.String({ format: "uuid" }) });
const reason = t.String({ minLength: 3, maxLength: 500 });
const change = t.Object({
  userId: t.String({ format: "uuid" }),
  attemptId: t.Optional(t.String({ format: "uuid" })),
  included: t.Optional(t.Boolean()),
  clearMetrics: t.Optional(t.Array(t.Union(METRICS.map((m) => t.Literal(m))))),
  metrics: t.Optional(
    t.Partial(
      t.Object({
        score: t.Number(),
        rank: t.Number(),
        mean: t.Number(),
        sd: t.Number(),
        z: t.Number(),
        percentile: t.Number(),
      }),
    ),
  ),
  reason,
});
type Change = {
  userId: string;
  attemptId?: string;
  included?: boolean;
  metrics?: Partial<Record<Metric, number>>;
  clearMetrics?: Metric[];
  reason: string;
};
async function validateChanges(packId: string, changes: Change[]) {
  if (
    !changes.length ||
    new Set(changes.map((c) => c.userId)).size !== changes.length
  )
    fail("รายการว่างหรือผู้ใช้ซ้ำ");
  const selected = (await refreshRanking(packId)).snapshot.rows;
  for (const c of changes) {
    const row = selected.find((r) => r.userId === c.userId);
    if (!row) fail("ผู้ใช้ไม่ได้สอบชุดนี้");
    if (c.attemptId) {
      const [a] = await db
        .select()
        .from(attempts)
        .where(
          and(
            eq(attempts.id, c.attemptId),
            eq(attempts.userId, c.userId),
            eq(attempts.packId, packId),
          ),
        );
      if (!a) fail("Attempt ไม่ตรงกับผู้ใช้/ชุดสอบ");
    }
    if (c.reason.trim().length < 3) fail("กรอกเหตุผลอย่างน้อย 3 ตัวอักษร");
    for (const [k, v] of Object.entries(c.metrics ?? {}))
      if (
        !METRICS.includes(k as Metric) ||
        !Number.isFinite(v) ||
        ((k === "score" || k === "sd") && v < 0) ||
        (k === "rank" && (!Number.isInteger(v) || v < 1)) ||
        (k === "percentile" && (v < 0 || v > 100))
      )
        fail(`ค่า ${k} ไม่ถูกต้อง`);
  }
}
export const adminRankingRoutes = new Elysia({ prefix: "/admin/ranking" })
  .use(adminGuard)
  .get("/", async () => ({
    packs: await db
      .select({
        id: examPacks.id,
        title: examPacks.title,
        slug: examPacks.slug,
      })
      .from(examPacks)
      .orderBy(examPacks.title),
  }))
  .get(
    "/:id",
    async ({ params, query }) => {
      const v = await refreshRanking(params.id);
      const rows = v.snapshot.rows.filter(
        (r) =>
          (!query.q ||
            `${r.name} ${r.email} ${r.userId}`
              .toLowerCase()
              .includes(query.q.toLowerCase())) &&
          (!query.flag || r.flags.includes(query.flag)),
      );
      return {
        version: v.version,
        versionId: v.id,
        snapshot: { ...v.snapshot, rows },
        versions: await db
          .select({
            id: rankingVersions.id,
            version: rankingVersions.version,
            trigger: rankingVersions.trigger,
            affectedCount: rankingVersions.affectedCount,
            reason: rankingVersions.reason,
            createdAt: rankingVersions.createdAt,
          })
          .from(rankingVersions)
          .where(eq(rankingVersions.packId, params.id))
          .orderBy(desc(rankingVersions.version))
          .limit(100),
      };
    },
    {
      params,
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 150 })),
        flag: t.Optional(t.String({ maxLength: 40 })),
      }),
    },
  )
  .put(
    "/:id/settings",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, `ranking:${params.id}`);
        const { config } = await calculateTx(tx, params.id);
        if (body.baseVersion !== config.version)
          fail("ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่", 409);
        if (body.publishedFinal) await authorize(headers, "ranking", "publish");
        if (config.publishedFinal && config.policy !== body.policy)
          fail("เปลี่ยนนโยบายเลือกครั้งสอบหลังเผยแพร่ผลรับรองไม่ได้", 409);
        await tx
          .update(rankingConfigs)
          .set(body)
          .where(eq(rankingConfigs.packId, params.id));
        return saveRanking(
          tx,
          params.id,
          await actorOf(headers),
          "settings",
          body.reason,
          true,
        );
      }),
    {
      params,
      body: t.Object({
        policy: t.Union([
          t.Literal("best"),
          t.Literal("first"),
          t.Literal("latest"),
        ]),
        visibility: t.Array(t.Union(METRICS.map((m) => t.Literal(m))), {
          uniqueItems: true,
        }),
        publishedFinal: t.Boolean(),
        suspiciousSeconds: t.Integer({ minimum: 0, maximum: 3600 }),
        baseVersion: t.Integer({ minimum: 0 }),
        reason,
      }),
    },
  )
  .post(
    "/:id/preview",
    async ({ params, body, headers }) => {
      const changes = body.changes as Change[];
      await validateChanges(params.id, changes);
      const actor = await actorOf(headers);
      const current = await refreshRanking(params.id);
      const proposed = await db.transaction(async (tx) => {
        await lock(tx, `ranking:${params.id}`);
        return (
          await calculateTx(
            tx,
            params.id,
            changes
              .filter((c) => c.included !== undefined)
              .map((c) => ({ userId: c.userId, included: c.included! })),
          )
        ).snapshot;
      });
      const warnings = changes.flatMap((c) =>
        Object.entries(c.metrics ?? {})
          .filter(
            ([k, v]) =>
              proposed.rows.find((r) => r.userId === c.userId)?.calculated[
                k as Metric
              ] !== v,
          )
          .map(([k]) => `${c.userId}: ${k} ต่างจากค่าคำนวณ`),
      );
      return {
        ...(await preview(
          "ranking",
          params.id,
          actor,
          String(current.version),
          { changes },
        )),
        before: {
          n: current.snapshot.nRank,
          nRef: current.snapshot.nRef,
          mean: current.snapshot.mean,
        },
        after: { n: proposed.nRank, nRef: proposed.nRef, mean: proposed.mean },
        changes,
        warnings,
      };
    },
    {
      params,
      body: t.Object({
        changes: t.Array(change, { minItems: 1, maxItems: 5000 }),
      }),
    },
  )
  .post(
    "/:id/commit",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, `ranking:${params.id}`);
        const actor = await actorOf(headers);
        const { config } = await calculateTx(tx, params.id);
        const payload = (await consumePreview(
          tx,
          body.previewId,
          "ranking",
          params.id,
          actor,
          String(config.version),
        )) as { changes: Change[] };
        for (const c of payload.changes) {
          if (c.clearMetrics?.length)
            await tx
              .delete(rankingOverrides)
              .where(
                and(
                  eq(rankingOverrides.packId, params.id),
                  eq(rankingOverrides.userId, c.userId),
                  inArray(rankingOverrides.metric, c.clearMetrics),
                ),
              );
          if (c.included !== undefined)
            await tx
              .insert(rankingDecisions)
              .values({
                packId: params.id,
                userId: c.userId,
                approvedReference: c.included,
                reason: c.reason,
                actorId: actor.id,
              })
              .onConflictDoUpdate({
                target: [rankingDecisions.packId, rankingDecisions.userId],
                set: {
                  approvedReference: c.included,
                  reason: c.reason,
                  actorId: actor.id,
                  updatedAt: new Date(),
                },
              });
          for (const [metric, value] of Object.entries(c.metrics ?? {}))
            await tx
              .insert(rankingOverrides)
              .values({
                packId: params.id,
                userId: c.userId,
                metric: metric as Metric,
                value,
                reason: c.reason,
                source: body.previewId,
                actorId: actor.id,
              })
              .onConflictDoUpdate({
                target: [
                  rankingOverrides.packId,
                  rankingOverrides.userId,
                  rankingOverrides.metric,
                ],
                set: {
                  value,
                  reason: c.reason,
                  actorId: actor.id,
                  source: body.previewId,
                  createdAt: new Date(),
                },
              });
        }
        return saveRanking(
          tx,
          params.id,
          actor,
          "approved_import",
          payload.changes.map((c) => c.reason).join("; "),
          true,
        );
      }),
    { params, body: t.Object({ previewId: t.String({ format: "uuid" }) }) },
  )
  .post(
    "/:id/import",
    async ({ params, body, headers }) => {
      const rows = await readSheet(body.file, [
        "user_id",
        "attempt_id",
        "included",
        "reason",
        ...METRICS,
      ]);
      const changes: Change[] = [];
      for (const [i, r] of rows.entries()) {
        const metrics: Partial<Record<Metric, number>> = {};
        for (const m of METRICS)
          if (r[m]?.trim()) {
            if (!/^-?\d+(\.\d+)?$/.test(r[m]!))
              fail(`แถว ${i + 2}: ${m} ต้องเป็นตัวเลข`);
            metrics[m] = Number(r[m]);
          }
        let userId = r.user_id;
        if (!userId && r.attempt_id) {
          const [a] = await db
            .select()
            .from(attempts)
            .where(
              and(
                eq(attempts.id, r.attempt_id),
                eq(attempts.packId, params.id),
              ),
            );
          userId = a?.userId;
        }
        if (!userId || !/^[-a-f0-9]{36}$/.test(userId))
          fail(`แถว ${i + 2}: user_id ไม่ถูกต้อง`);
        if (r.included && !["0", "1", "true", "false"].includes(r.included))
          fail(`แถว ${i + 2}: included ต้องเป็น 0/1`);
        changes.push({
          userId: userId!,
          ...(r.attempt_id ? { attemptId: r.attempt_id } : {}),
          ...(r.included
            ? { included: ["1", "true"].includes(r.included) }
            : {}),
          metrics,
          reason: r.reason ?? "",
        });
      }
      await validateChanges(params.id, changes);
      const current = await refreshRanking(params.id);
      const proposed = await db.transaction(async (tx) => {
        await lock(tx, `ranking:${params.id}`);
        return (
          await calculateTx(
            tx,
            params.id,
            changes
              .filter((c) => c.included !== undefined)
              .map((c) => ({ userId: c.userId, included: c.included! })),
          )
        ).snapshot;
      });
      return {
        after: { n: proposed.nRank, nRef: proposed.nRef, mean: proposed.mean },
        diff: changes.map((c) => ({
          userId: c.userId,
          before: current.snapshot.rows.find((r) => r.userId === c.userId)
            ?.official,
          after: {
            ...proposed.rows.find((r) => r.userId === c.userId)?.official,
            ...c.metrics,
          },
        })),
        ...(await preview(
          "ranking",
          params.id,
          await actorOf(headers),
          String(current.version),
          { changes },
        )),
        changes,
        before: {
          n: current.snapshot.nRank,
          nRef: current.snapshot.nRef,
          mean: current.snapshot.mean,
        },
        warnings: ["ค่าที่นำเข้าจะอยู่ในผลรับรอง คำตอบดิบและประวัติการตรวจคะแนนคงเดิม"],
      };
    },
    { params, body: t.Object({ file: t.File({ maxSize: 3 * 1024 * 1024 }) }) },
  )
  .get(
    "/:id/export",
    async ({ params, set }) => {
      const v = await refreshRanking(params.id);
      set.headers["content-type"] = "text/csv; charset=utf-8";
      set.headers["content-disposition"] = 'attachment; filename="ranking.csv"';
      return csv([
        ["user_id", "attempt_id", "included", "reason", ...METRICS],
        ...v.snapshot.rows.map((r) => [
          r.userId,
          r.attemptId,
          r.reference ? 1 : 0,
          "",
          ...METRICS.map((m) => r.official[m]),
        ]),
      ]);
    },
    { params },
  )
  .get(
    "/:id/versions/:versionId",
    async ({ params }) => {
      const [v] = await db
        .select()
        .from(rankingVersions)
        .where(
          and(
            eq(rankingVersions.packId, params.id),
            eq(rankingVersions.id, params.versionId),
          ),
        );
      if (!v) fail("ไม่พบเวอร์ชัน", 404);
      return { version: v };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        versionId: t.String({ format: "uuid" }),
      }),
    },
  )
  .post(
    "/:id/rollback",
    async ({ params, body, headers }) =>
      db.transaction(async (tx) => {
        await lock(tx, `ranking:${params.id}`);
        const actor = await actorOf(headers);
        const { config } = await calculateTx(tx, params.id);
        if (body.baseVersion !== config.version) fail("ข้อมูลเปลี่ยนแล้ว", 409);
        const [v] = await tx
          .select()
          .from(rankingVersions)
          .where(
            and(
              eq(rankingVersions.id, body.versionId),
              eq(rankingVersions.packId, params.id),
            ),
          );
        if (!v) fail("ไม่พบเวอร์ชัน", 404);
        await tx
          .delete(rankingOverrides)
          .where(eq(rankingOverrides.packId, params.id));
        await tx
          .delete(rankingDecisions)
          .where(eq(rankingDecisions.packId, params.id));
        for (const row of v!.snapshot.rows)
          await tx
            .insert(rankingDecisions)
            .values({
              packId: params.id,
              userId: row.userId,
              approvedReference: row.reference,
              reason: body.reason,
              actorId: actor.id,
            });
        for (const r of v!.snapshot.rows)
          for (const [m, o] of Object.entries(r.overrides))
            if (o)
              await tx.insert(rankingOverrides).values({
                packId: params.id,
                userId: r.userId,
                metric: m as Metric,
                value: o.value,
                reason: o.reason,
                source: o.source,
                actorId: o.actorId,
                createdAt: new Date(o.at),
              });
        await tx
          .update(rankingConfigs)
          .set({
            policy: v!.snapshot.policy,
            visibility: v!.snapshot.visibility,
            publishedFinal: v!.snapshot.publishedFinal,
          })
          .where(eq(rankingConfigs.packId, params.id));
        const restored = (await calculateTx(tx, params.id)).snapshot;
        for (const r of restored.rows) {
          const historical = v!.snapshot.rows.find(
            (h) => h.userId === r.userId,
          );
          if (historical) {
            r.official = historical.official;
            r.review = historical.review;
          }
        }
        const [next] = await tx
          .insert(rankingVersions)
          .values({
            packId: params.id,
            version: config.version + 1,
            trigger: "rollback",
            actorId: actor.id,
            reason: body.reason,
            rollbackOf: v!.id,
            snapshot: restored,
            affectedCount: restored.rows.length,
          })
          .returning();
        await tx
          .update(rankingConfigs)
          .set({
            currentVersionId: next!.id,
            version: next!.version,
            publishedFinal: v!.snapshot.publishedFinal,
          })
          .where(eq(rankingConfigs.packId, params.id));
        await auditTx(tx, actor, {
          action: "ranking.rollback",
          module: "ranking",
          targetId: params.id,
          reason: body.reason,
          after: { from: config.version, to: v!.version },
          revisionId: next!.id,
        });
        return next!;
      }),
    {
      params,
      body: t.Object({
        versionId: t.String({ format: "uuid" }),
        baseVersion: t.Integer({ minimum: 1 }),
        reason,
      }),
    },
  )
  .get("/:id/activity/:attemptId",async({params})=>db.transaction(tx=>activityEvidence(tx,params.id,params.attemptId)),{params:t.Object({id:t.String({format:"uuid"}),attemptId:t.String({format:"uuid"})})})
  .post("/:id/time/preview",async({params,body,headers})=>{
    const evidence=await db.transaction(tx=>activityEvidence(tx,params.id,body.attemptId));
    if(evidence.attempt.status==="in_progress")fail("รอให้การสอบสิ้นสุดก่อนตรวจรับเวลา",409);
    if(evidence.attempt.resetAt)fail("ครั้งสอบนี้ถูกรีเซ็ตแล้ว",409);
    if(body.reason.trim().length<3)fail("กรอกเหตุผลและหลักฐานที่ใช้ตรวจรับ");
    const limit=Math.max(0,Math.floor((activityEnd(evidence.attempt)-evidence.attempt.startedAt.getTime())/1000));
    if(body.activeSeconds>limit)fail("เวลาสะสมเกินระยะเวลาสอบที่เซิร์ฟเวอร์กำหนด");
    return {...await preview("ranking_time",params.id,await actorOf(headers),evidence.version,body),before:evidence.attempt,after:{activeSeconds:body.activeSeconds,activeVerified:true},note:"การรับรองนี้อาจเปลี่ยนครั้งสอบที่เลือกและอันดับ ระบบสร้าง revision และ Audit ใหม่"};
  },{params,body:t.Object({attemptId:t.String({format:"uuid"}),activeSeconds:t.Integer({minimum:0,maximum:86400}),reason})})
  .put("/:id/time",async({params,body,headers})=>db.transaction(async tx=>{
    await lock(tx,`ranking:${params.id}`);
    const actor=await actorOf(headers);
    const {actionPreviews}=await import("../../db/features");
    const [p]=await tx.select().from(actionPreviews).where(eq(actionPreviews.id,body.previewId));
    const candidate=p?.payload as {attemptId:string}|undefined;
    if(!candidate)fail("ไม่พบรายการตัวอย่าง",404);
    await tx.select().from(attempts).where(eq(attempts.id,candidate!.attemptId)).for("update");
    const evidence=await activityEvidence(tx,params.id,candidate!.attemptId);
    const plan=await consumePreview(tx,body.previewId,"ranking_time",params.id,actor,evidence.version) as {attemptId:string;activeSeconds:number;reason:string};
    await tx.update(attempts).set({activeSeconds:plan.activeSeconds,activeRemainderMs:0,activeVerified:true,activeReviewedAt:new Date()}).where(eq(attempts.id,plan.attemptId));
    await auditTx(tx,actor,{action:"ranking.time_review",module:"ranking",targetId:plan.attemptId,before:evidence.attempt,after:{activeSeconds:plan.activeSeconds,activeVerified:true,evidenceVersion:evidence.version,streamIds:evidence.streams.map(s=>s.id)},reason:plan.reason,sourceId:body.previewId});
    return saveRanking(tx,params.id,actor,"time_review",plan.reason,true);
  }),{params,body:t.Object({previewId:t.String({format:"uuid"})})});
