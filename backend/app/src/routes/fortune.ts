import { and, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { currentUser, type SessionUser } from "../auth";
import { PCSHS_CAMPUS_CODES } from "../campuses";
import { db } from "../db";
import { fortuneReadings, orders, products } from "../db/schema";
import { generateFortune, validateFortuneInput, type FortuneInput, type FortuneResult } from "../fortune";

/** Topic used when the client sends none (seeded in db/seed.ts). */
const DEFAULT_TOPIC_SLUG = "fortune-single";

/**
 * A reading is a per-purchase consumable, so access is the linked order
 * being paid — not an entitlements row, which is one-per-product and would
 * unlock every later reading for free. Staff roles skip payment so the
 * module can be exercised before the gateway keys arrive.
 */
function unlocked(user: SessionUser, orderStatus: string | null): boolean {
  return orderStatus === "paid" || user.role === "admin" || user.role === "dev" || user.role === "test";
}

const cols = {
  id: fortuneReadings.id,
  input: fortuneReadings.input,
  result: fortuneReadings.result,
  parentConsent: fortuneReadings.parentConsent,
  createdAt: fortuneReadings.createdAt,
  orderId: orders.id,
  orderStatus: orders.status,
  amountSatang: orders.amountSatang,
};

type Row = {
  id: string;
  input: unknown;
  result: unknown;
  parentConsent: boolean;
  createdAt: Date;
  orderId: string | null;
  orderStatus: "pending" | "paid" | "failed" | "refunded" | null;
  amountSatang: number | null;
};

/** Client-bound shape. `result` is withheld until the reading is unlocked. */
function serialize(row: Row, user: SessionUser) {
  const open = unlocked(user, row.orderStatus);
  return {
    id: row.id,
    input: row.input as FortuneInput,
    parentConsent: row.parentConsent,
    createdAt: row.createdAt,
    order: row.orderId ? { id: row.orderId, status: row.orderStatus, amountSatang: row.amountSatang } : null,
    unlocked: open,
    result: open ? (row.result as FortuneResult | null) : null,
  };
}

/**
 * The reading is written on first unlocked read, not at submit, so the AI
 * runs only for paid (or staff) readings. A result that came from the
 * rule-based fallback because the AI failed is served but not stored, so
 * the next read tries the AI again. `result IS NULL` in the update keeps
 * two concurrent first reads from overwriting each other.
 */
async function ensureResult(row: Row, user: SessionUser): Promise<Row> {
  if (row.result || !unlocked(user, row.orderStatus)) return row;
  const generated = await generateFortune(row.input as FortuneInput);
  if (!generated.persistent) return { ...row, result: generated.result };
  const [stored] = await db
    .update(fortuneReadings)
    .set({ result: generated.result })
    .where(and(eq(fortuneReadings.id, row.id), isNull(fortuneReadings.result)))
    .returning({ result: fortuneReadings.result });
  if (stored) return { ...row, result: stored.result };
  // Lost the race: another request stored first; serve theirs.
  const [fresh] = await db.select({ result: fortuneReadings.result }).from(fortuneReadings).where(eq(fortuneReadings.id, row.id)).limit(1);
  return { ...row, result: fresh?.result ?? generated.result };
}

const readingBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  dob: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  birthTime: t.Optional(t.String({ pattern: "^\\d{2}:\\d{2}$" })),
  campus: t.UnionEnum(PCSHS_CAMPUS_CODES),
  question: t.String({ minLength: 1, maxLength: 200 }),
  /** Slug of an active fortune product; each one is a topic with its own price. */
  productSlug: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
});

export const fortuneRoutes = new Elysia({ prefix: "/fortune" })
  /**
   * Submit the form. Stores the input with a pending order for one reading;
   * the result itself is generated on the first read after the order is
   * paid (see ensureResult), so nothing is spent on an unpaid submission.
   */
  .post(
    "/readings",
    async ({ body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบก่อนดูดวง" };
      }
      const input: FortuneInput = {
        name: body.name.trim(),
        dob: body.dob,
        birthTime: body.birthTime?.trim() || null,
        campus: body.campus,
        question: body.question.trim(),
      };
      const invalid = validateFortuneInput(input);
      if (invalid) {
        set.status = 422;
        return { error: invalid };
      }

      const [product] = await db
        .select({ id: products.id, title: products.title, priceSatang: products.priceSatang })
        .from(products)
        .where(and(eq(products.slug, body.productSlug ?? DEFAULT_TOPIC_SLUG), eq(products.kind, "fortune"), eq(products.active, true)))
        .limit(1);
      if (!product) {
        set.status = body.productSlug ? 422 : 503;
        return { error: body.productSlug ? "ไม่พบหัวข้อดูดวงที่เลือก" : "บริการดูดวงยังไม่เปิดให้ซื้อในขณะนี้" };
      }
      input.topic = product.title;

      const reading = await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            userId: user.id,
            productId: product.id,
            amountSatang: product.priceSatang,
            studentName: input.name,
            targetCampus: input.campus,
            receiptEmail: user.email,
          })
          .returning({ id: orders.id, status: orders.status, amountSatang: orders.amountSatang });
        const [row] = await tx
          .insert(fortuneReadings)
          .values({ userId: user.id, orderId: order.id, input })
          .returning({ id: fortuneReadings.id, input: fortuneReadings.input, result: fortuneReadings.result, parentConsent: fortuneReadings.parentConsent, createdAt: fortuneReadings.createdAt });
        return { ...row, orderId: order.id, orderStatus: order.status, amountSatang: order.amountSatang };
      });

      set.status = 201;
      return { reading: serialize(reading, user) };
    },
    { body: readingBody }
  )

  /**
   * The caller's readings, newest first. `?order=` narrows to the one bought
   * with that order (Omise return_uri lands with an order id). Never
   * generates: an unlocked row with `result: null` means "fetch it by id".
   */
  .get(
    "/readings",
    async ({ query, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const where = query.order
        ? and(eq(fortuneReadings.userId, user.id), eq(fortuneReadings.orderId, query.order))
        : eq(fortuneReadings.userId, user.id);
      const rows = await db
        .select(cols)
        .from(fortuneReadings)
        .leftJoin(orders, eq(orders.id, fortuneReadings.orderId))
        .where(where)
        .orderBy(desc(fortuneReadings.createdAt))
        .limit(20);
      return { readings: rows.map((r) => serialize(r, user)) };
    },
    { query: t.Object({ order: t.Optional(t.String({ format: "uuid" })) }) }
  )

  .get(
    "/readings/:id",
    async ({ params, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      // Scoped to the session user so another user's id reads as not found.
      const [row] = await db
        .select(cols)
        .from(fortuneReadings)
        .leftJoin(orders, eq(orders.id, fortuneReadings.orderId))
        .where(and(eq(fortuneReadings.id, params.id), eq(fortuneReadings.userId, user.id)))
        .limit(1);
      if (!row) {
        set.status = 404;
        return { error: "ไม่พบคำทำนาย" };
      }
      return { reading: serialize(await ensureResult(row, user), user) };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  )

  /** Parent-consent tick on the pay step, recorded before the charge starts. */
  .post(
    "/readings/:id/consent",
    async ({ params, body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const [row] = await db
        .update(fortuneReadings)
        .set({ parentConsent: body.parentConsent })
        .where(and(eq(fortuneReadings.id, params.id), eq(fortuneReadings.userId, user.id)))
        .returning({ id: fortuneReadings.id, parentConsent: fortuneReadings.parentConsent });
      if (!row) {
        set.status = 404;
        return { error: "ไม่พบคำทำนาย" };
      }
      return { reading: row };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }), body: t.Object({ parentConsent: t.Boolean() }) }
  );
