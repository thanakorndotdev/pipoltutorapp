import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { attempts, examPacks, users } from "../db/schema";
import {
  rankingConfigs,
  rankingDecisions,
  rankingOverrides,
  rankingVersions,
  type Metric,
  type Metrics,
  type RankedRow,
  type RankingSnapshot,
} from "../db/features";
import { SYSTEM, type Actor } from "../audit";
import { auditTx, fail, hash, lock, type Tx } from "./common";

export const METRICS: Metric[] = [
  "score",
  "rank",
  "mean",
  "sd",
  "z",
  "percentile",
];
export type Candidate = {
  id: string;
  userId: string;
  score: number;
  activeSeconds: number | null;
  activeVerified: boolean;
  startedAt: Date;
  name: string;
  email: string;
  test: boolean;
};
const time = (a: Candidate) =>
  a.activeVerified && a.activeSeconds !== null ? a.activeSeconds : Infinity;
export const compare = (a: Candidate, b: Candidate) =>
  b.score - a.score ||
  (time(a) === time(b) ? 0 : time(a) - time(b)) ||
  a.startedAt.getTime() - b.startedAt.getTime();
export function calculate(
  candidates: Candidate[],
  excluded = new Set<string>(),
  policy = "best",
  suspiciousSeconds = 30,
): Omit<
  RankingSnapshot,
  "publishedFinal" | "policy" | "visibility" | "dataHash"
> {
  const selected = new Map<string, Candidate>();
  for (const a of candidates) {
    const prev = selected.get(a.userId);
    if (
      !prev ||
      (policy === "first"
        ? a.startedAt < prev.startedAt
        : policy === "latest"
          ? a.startedAt > prev.startedAt
          : compare(a, prev) < 0)
    )
      selected.set(a.userId, a);
  }
  const sorted = [...selected.values()].sort(
    (a, b) => compare(a, b) || a.userId.localeCompare(b.userId),
  );
  const reference = sorted
    .filter((a) => !excluded.has(a.userId))
    .map((a) => a.score);
  const nRef = reference.length;
  const mean = nRef ? reference.reduce((a, b) => a + b, 0) / nRef : null;
  const sd = nRef
    ? Math.sqrt(reference.reduce((a, b) => a + (b - mean!) ** 2, 0) / nRef)
    : null;
  let rank = 0;
  const rows: RankedRow[] = sorted.map((a, i) => {
    if (i === 0 || compare(a, sorted[i - 1]!) !== 0) rank = i + 1;
    const flags = [
      ...(!a.activeVerified || a.activeSeconds === null
        ? ["unverified_time"]
        : []),
      ...(a.activeSeconds !== null && a.activeSeconds < suspiciousSeconds
        ? ["short_duration"]
        : []),
      ...(a.test ? ["test_account"] : []),
    ];
    const calculated: Metrics = {
      score: a.score,
      rank,
      mean,
      sd,
      z: mean === null ? null : sd === 0 ? 0 : (a.score - mean) / sd!,
      percentile: nRef
        ? (100 *
            (reference.filter((s) => s < a.score).length +
              0.5 * reference.filter((s) => s === a.score).length)) /
          nRef
        : null,
    };
    return {
      userId: a.userId,
      attemptId: a.id,
      name: a.name,
      email: a.email,
      activeSeconds: a.activeVerified ? a.activeSeconds : null,
      startedAt: a.startedAt.toISOString(),
      flags,
      reference: !excluded.has(a.userId),
      calculated,
      official: { ...calculated },
      overrides: {},
      review: [],
    };
  });
  return { nRank: rows.length, nRef, mean, sd, rows };
}

export async function calculateTx(
  tx: Tx,
  packId: string,
  decisionChanges: { userId: string; included: boolean }[] = [],
) {
  const [pack] = await tx
    .select({ id: examPacks.id })
    .from(examPacks)
    .where(eq(examPacks.id, packId));
  if (!pack) fail("ไม่พบชุดข้อสอบ", 404);
  await tx.insert(rankingConfigs).values({ packId }).onConflictDoNothing();
  const [config] = await tx
    .select()
    .from(rankingConfigs)
    .where(eq(rankingConfigs.packId, packId));
  const raw = await tx
    .select({
      id: attempts.id,
      userId: attempts.userId,
      score: attempts.score,
      activeSeconds: attempts.activeSeconds,
      activeVerified: attempts.activeVerified,
      startedAt: attempts.startedAt,
      first: attempts.studentFirstName,
      last: attempts.studentLastName,
      email: attempts.studentEmail,
      role: users.role,
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(
      and(
        eq(attempts.packId, packId),
        ne(attempts.status, "in_progress"),
        isNull(attempts.resetAt),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(attempts.id));
  const decisions = await tx
    .select()
    .from(rankingDecisions)
    .where(eq(rankingDecisions.packId, packId));
  const excluded = new Set(
    decisions.filter((d) => !d.approvedReference).map((d) => d.userId),
  );
  for (const d of decisionChanges)
    d.included ? excluded.delete(d.userId) : excluded.add(d.userId);
  const candidates = raw
    .filter((a) => a.score !== null)
    .map((a) => ({
      id: a.id,
      userId: a.userId,
      score: a.score!,
      activeSeconds: a.activeSeconds,
      activeVerified: a.activeVerified,
      startedAt: a.startedAt,
      name: [a.first, a.last].filter(Boolean).join(" "),
      email: a.email ?? "",
      test: a.role !== "student",
    }));
  const calculated = calculate(
    candidates,
    excluded,
    config!.policy,
    config!.suspiciousSeconds,
  );
  const overrides = await tx
    .select()
    .from(rankingOverrides)
    .where(eq(rankingOverrides.packId, packId));
  const [previous] = config!.currentVersionId
    ? await tx
        .select()
        .from(rankingVersions)
        .where(eq(rankingVersions.id, config!.currentVersionId))
    : [];
  for (const row of calculated.rows) {
    const prev = previous?.snapshot.rows.find((r) => r.userId === row.userId);
    for (const o of overrides.filter((o) => o.userId === row.userId)) {
      row.official[o.metric] = o.value;
      row.overrides[o.metric] = {
        value: o.value,
        reason: o.reason,
        actorId: o.actorId,
        source: o.source,
        at: o.createdAt.toISOString(),
      };
      if (
        prev?.review.includes(o.metric) ||
        (prev && prev.calculated[o.metric] !== row.calculated[o.metric])
      )
        row.review.push(o.metric);
    }
  }
  const snapshot: RankingSnapshot = {
    ...calculated,
    publishedFinal: config!.publishedFinal,
    policy: config!.policy,
    visibility: config!.visibility,
    dataHash: hash({
      raw,
      decisions: [...excluded].sort(),
      overrides,
      config: {
        policy: config!.policy,
        visibility: config!.visibility,
        final: config!.publishedFinal,
        threshold: config!.suspiciousSeconds,
      },
    }),
  };
  return { config: config!, previous, snapshot };
}
export async function saveRanking(
  tx: Tx,
  packId: string,
  actor: Actor,
  trigger: string,
  reason?: string,
  force = false,
) {
  const { config, previous, snapshot } = await calculateTx(tx, packId);
  if (!force && previous?.snapshot.dataHash === snapshot.dataHash)
    return previous;
  const affectedCount = snapshot.rows.filter(
    (r) =>
      JSON.stringify(r) !==
      JSON.stringify(
        previous?.snapshot.rows.find((p) => p.userId === r.userId),
      ),
  ).length;
  const [version] = await tx
    .insert(rankingVersions)
    .values({
      packId,
      version: config.version + 1,
      trigger,
      actorId: actor.id,
      reason,
      snapshot,
      affectedCount,
    })
    .returning();
  await tx
    .update(rankingConfigs)
    .set({ version: version!.version, currentVersionId: version!.id })
    .where(eq(rankingConfigs.packId, packId));
  await auditTx(tx, actor, {
    action: "ranking.recalculate",
    module: "ranking",
    targetId: packId,
    after: {
      version: version!.version,
      affectedCount,
      nRank: snapshot.nRank,
      nRef: snapshot.nRef,
    },
    reason,
    revisionId: version!.id,
  });
  return version!;
}
export async function refreshRanking(
  packId: string,
  actor: Actor = SYSTEM,
  trigger = "data_change",
) {
  return db.transaction(async (tx) => {
    await lock(tx, `ranking:${packId}`);
    return saveRanking(tx, packId, actor, trigger);
  });
}
export async function ownRanking(attemptId: string, userId: string) {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)));
  if (!attempt) fail("ไม่พบผลสอบ", 404);
  const version = await readRanking(attempt!.packId);
  const snapshot = version.snapshot;
  const row = snapshot.rows.find((r) => r.userId === userId);
  return {
    status: snapshot.publishedFinal ? "final" : "preliminary",
    version: version.version,
    nRank: snapshot.nRank,
    nRef: snapshot.nRef,
    selectedAttemptId: row?.attemptId ?? null,
    metrics: row
      ? Object.fromEntries(
          snapshot.visibility.map((k) => [k, row.official[k as Metric]]),
        )
      : null,
    needsReview:
      row?.review.some((k) => snapshot.visibility.includes(k)) ?? false,
    zeroSd: snapshot.sd === 0,
    note: snapshot.publishedFinal
      ? row?.review.length
        ? "ผลคะแนนที่เผยแพร่ล่าสุดอยู่ระหว่างการทบทวนข้อมูลใหม่"
        : "ผลคะแนนรับรองล่าสุด"
      : "ผลเบื้องต้นจากข้อมูลผู้ส่งข้อสอบ ณ ขณะนี้ อันดับอาจเปลี่ยนเมื่อมีผู้ส่งเพิ่มเติมหรือมีการปรับคะแนน",
    statisticalNote: "สถิติใช้้กลุ่มอ้างอิงตามเกณฑ์ที่ผู้ดูแลอนุมัติ",
  };
}

export async function readRanking(packId: string) {
  const [c] = await db
    .select()
    .from(rankingConfigs)
    .where(eq(rankingConfigs.packId, packId));
  if (c?.currentVersionId) {
    const [v] = await db
      .select()
      .from(rankingVersions)
      .where(eq(rankingVersions.id, c.currentVersionId));
    if (v) return v;
  }
  return refreshRanking(packId);
}

/**
 * Student transport, respecting module visibility: every graded attempt shows its own
 * score, and the one the ranking policy selected shows its official (possibly adjusted) score.
 */
export async function studentAttemptResult<
  T extends {
    id: string;
    packId: string;
    status: string;
    score: number | null;
    topicBreakdown: unknown;
  },
>(attempt: T) {
  if (attempt.status === "in_progress")
    return { ...attempt, score: null, topicBreakdown: null };
  const { snapshot } = await readRanking(attempt.packId);
  const row = snapshot.rows.find((r) => r.attemptId === attempt.id);
  const visible = snapshot.visibility.includes("score");
  return {
    ...attempt,
    score: visible ? (row ? row.official.score : attempt.score) : null,
    topicBreakdown: visible ? attempt.topicBreakdown : null,
    scoreStatus: snapshot.publishedFinal ? "final" : "preliminary",
    scoreVisible: visible,
    selectedForRanking: Boolean(row),
  };
}
