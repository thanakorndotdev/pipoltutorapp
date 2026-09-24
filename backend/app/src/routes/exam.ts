import { Elysia, t } from "elysia";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { currentUser } from "../auth";
import { db } from "../db";
import { attempts, entitlements, examPacks, packProducts, type UserRole } from "../db/schema";
import { allowedSeconds, getExamSettings } from "../exam-settings";

/**
 * Pack timing as the client may see it. `durationSeconds` is the time the
 * pack was written for; `allowedSeconds` is what the student actually gets
 * after the multiplier in exam_settings is applied.
 */
async function packTiming(pack: { durationSeconds: number }) {
  const settings = await getExamSettings();
  return {
    durationSeconds: pack.durationSeconds,
    timeMultiplierPercent: settings.timeMultiplierPercent,
    allowedSeconds: allowedSeconds(
      pack.durationSeconds,
      settings.timeMultiplierPercent
    ),
  };
}

const packColumns = {
  id: examPacks.id,
  slug: examPacks.slug,
  title: examPacks.title,
  questionCount: examPacks.questionCount,
  durationSeconds: examPacks.durationSeconds,
};

/** Product ids that unlock each pack; a pack absent from the map is free. */
async function unlockingProducts(packIds: string[]) {
  const map = new Map<string, string[]>();
  if (packIds.length === 0) return map;
  const rows = await db
    .select({ packId: packProducts.packId, productId: packProducts.productId })
    .from(packProducts)
    .where(inArray(packProducts.packId, packIds));
  for (const r of rows) map.set(r.packId, [...(map.get(r.packId) ?? []), r.productId]);
  return map;
}

/** Products the user holds a live entitlement on. */
async function liveEntitlementProductIds(userId: string) {
  const rows = await db
    .select({ productId: entitlements.productId })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date()))
      )
    );
  return new Set(rows.map((r) => r.productId));
}

/** Staff and QA accounts open every pack without buying, as in fortune. */
function bypassesPaywall(user: { role: UserRole } | null) {
  return user !== null && (user.role === "admin" || user.role === "dev" || user.role === "test");
}

/** A pack is open when it is free or any unlocking product is entitled. */
function isUnlocked(productIds: string[], owned: Set<string>) {
  return productIds.length === 0 || productIds.some((id) => owned.has(id));
}

const attemptColumns = {
  id: attempts.id,
  packId: attempts.packId,
  status: attempts.status,
  startedAt: attempts.startedAt,
  expiresAt: attempts.expiresAt,
  submittedAt: attempts.submittedAt,
  score: attempts.score,
  topicBreakdown: attempts.topicBreakdown,
};

export const examPacksRoutes = new Elysia({ prefix: "/exam-packs" })
  /**
   * Every pack with the products that unlock it. `unlocked` is computed for
   * the session user when there is one; anonymous callers see only free packs
   * as unlocked. Advisory for the UI — POST /attempts is the real gate.
   */
  .get("/", async ({ headers }) => {
    const rows = await db.select(packColumns).from(examPacks).orderBy(examPacks.title);
    const [settings, unlocks, user] = await Promise.all([
      getExamSettings(),
      unlockingProducts(rows.map((r) => r.id)),
      currentUser(headers),
    ]);
    const owned = user ? await liveEntitlementProductIds(user.id) : new Set<string>();
    const bypass = bypassesPaywall(user);
    return {
      packs: rows.map((pack) => {
        const productIds = unlocks.get(pack.id) ?? [];
        return {
          ...pack,
          productIds,
          unlocked: bypass || isUnlocked(productIds, owned),
          timeMultiplierPercent: settings.timeMultiplierPercent,
          allowedSeconds: allowedSeconds(
            pack.durationSeconds,
            settings.timeMultiplierPercent
          ),
        };
      }),
    };
  })
  .get(
    "/:slug",
    async ({ params, headers, set }) => {
      const [pack] = await db
        .select(packColumns)
        .from(examPacks)
        .where(eq(examPacks.slug, params.slug))
        .limit(1);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }
      const [unlocks, user] = await Promise.all([
        unlockingProducts([pack.id]),
        currentUser(headers),
      ]);
      const productIds = unlocks.get(pack.id) ?? [];
      const owned = user ? await liveEntitlementProductIds(user.id) : new Set<string>();
      return {
        pack: {
          ...pack,
          productIds,
          unlocked: bypassesPaywall(user) || isUnlocked(productIds, owned),
          ...(await packTiming(pack)),
        },
      };
    },
    { params: t.Object({ slug: t.String({ minLength: 1, maxLength: 80 }) }) }
  );

export const attemptsRoutes = new Elysia({ prefix: "/attempts" })
  /**
   * Start an attempt. The deadline is fixed here from the pack duration and
   * the multiplier in exam_settings; the client never supplies time.
   */
  .post(
    "/",
    async ({ body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบก่อนทำข้อสอบ" };
      }

      const [pack] = await db
        .select(packColumns)
        .from(examPacks)
        .where(eq(examPacks.id, body.packId))
        .limit(1);
      if (!pack) {
        set.status = 404;
        return { error: "ไม่พบชุดข้อสอบ" };
      }

      // Paid packs need a live entitlement on any unlocking product; order
      // status alone is not access.
      const productIds = (await unlockingProducts([pack.id])).get(pack.id) ?? [];
      if (productIds.length > 0 && !bypassesPaywall(user)) {
        const owned = await liveEntitlementProductIds(user.id);
        if (!isUnlocked(productIds, owned)) {
          set.status = 403;
          return { error: "ยังไม่มีสิทธิ์ทำชุดข้อสอบนี้" };
        }
      }

      // Resume an open attempt instead of stacking a second clock.
      const [open] = await db
        .select(attemptColumns)
        .from(attempts)
        .where(
          and(
            eq(attempts.userId, user.id),
            eq(attempts.packId, pack.id),
            eq(attempts.status, "in_progress"),
            gt(attempts.expiresAt, new Date())
          )
        )
        .limit(1);
      const timing = await packTiming(pack);
      if (open) {
        return { attempt: { ...open, ...timing }, resumed: true };
      }

      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + timing.allowedSeconds * 1000);
      const [attempt] = await db
        .insert(attempts)
        .values({ userId: user.id, packId: pack.id, startedAt, expiresAt })
        .returning(attemptColumns);

      set.status = 201;
      return { attempt: { ...attempt, ...timing }, resumed: false };
    },
    { body: t.Object({ packId: t.String({ format: "uuid" }) }) }
  )
  .get(
    "/:id",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      // Scoped to the session user so another user's id reads as not found.
      const [row] = await db
        .select({ ...attemptColumns, durationSeconds: examPacks.durationSeconds })
        .from(attempts)
        .innerJoin(examPacks, eq(examPacks.id, attempts.packId))
        .where(and(eq(attempts.id, params.id), eq(attempts.userId, user.id)))
        .limit(1);
      if (!row) {
        set.status = 404;
        return { error: "ไม่พบการทำข้อสอบ" };
      }
      const now = new Date();
      const { durationSeconds, ...attempt } = row;
      return {
        attempt: {
          ...attempt,
          allowedSeconds: Math.round(
            (attempt.expiresAt.getTime() - attempt.startedAt.getTime()) / 1000
          ),
          durationSeconds,
          secondsLeft: Math.max(
            0,
            Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000)
          ),
          serverNow: now.toISOString(),
        },
      };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  );
