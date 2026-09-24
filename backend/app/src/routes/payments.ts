import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { currentUser } from "../auth";
import { db } from "../db";
import { orders } from "../db/schema";
import {
  GATEWAY,
  OmiseApiError,
  applyCharge,
  createCardCharge,
  createPromptPayCharge,
  getCharge,
  omiseConfigured,
  omisePublicKey,
  publicCharge,
  type OmiseCharge,
} from "../payments/omise";

const orderCols = { id: orders.id, status: orders.status, amountSatang: orders.amountSatang, userId: orders.userId, productId: orders.productId, gateway: orders.gateway, gatewayRef: orders.gatewayRef };

function describe(error: unknown): string {
  if (error instanceof OmiseApiError) return `ชำระเงินไม่สำเร็จ: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

export const paymentsRoutes = new Elysia({ prefix: "/payments" })
  /** What the checkout page needs to render the payment step. */
  .get("/config", () => ({ provider: GATEWAY, configured: omiseConfigured(), publicKey: omisePublicKey(), methods: ["promptpay", "card"] }))

  /**
   * Start (or resume) payment for one of the caller's pending orders.
   * PromptPay returns a QR to scan; card needs an Omise.js token and may
   * return an authorizeUri for 3-D Secure.
   */
  .post(
    "/charge",
    async ({ body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      if (!omiseConfigured()) {
        set.status = 503;
        return { error: "ระบบชำระเงินยังไม่เปิดใช้งาน" };
      }
      const [order] = await db.select(orderCols).from(orders).where(and(eq(orders.id, body.orderId), eq(orders.userId, user.id))).limit(1);
      if (!order) {
        set.status = 404;
        return { error: "ไม่พบคำสั่งซื้อ" };
      }
      if (order.status === "paid") return { order: { id: order.id, status: order.status }, charge: null };
      if (order.status !== "pending") {
        set.status = 409;
        return { error: "คำสั่งซื้อนี้ปิดไปแล้ว กรุณาสร้างคำสั่งซื้อใหม่" };
      }

      try {
        // Resume a still-open PromptPay charge instead of minting a second QR.
        if (body.method === "promptpay" && order.gateway === GATEWAY && order.gatewayRef) {
          const existing = await getCharge(order.gatewayRef);
          if (existing.status === "pending" && existing.source?.type === "promptpay") {
            const status = await applyCharge(order.id, existing);
            return { order: { id: order.id, status }, charge: publicCharge(existing) };
          }
        }

        let charge: OmiseCharge;
        if (body.method === "promptpay") {
          charge = await createPromptPayCharge(order);
        } else {
          if (!body.token) {
            set.status = 422;
            return { error: "ไม่พบข้อมูลบัตร กรุณากรอกใหม่" };
          }
          charge = await createCardCharge(order, body.token);
        }
        const status = await applyCharge(order.id, charge);
        return { order: { id: order.id, status }, charge: publicCharge(charge) };
      } catch (error) {
        console.error("payments/charge:", describe(error));
        set.status = error instanceof OmiseApiError ? 402 : 502;
        return { error: error instanceof OmiseApiError ? describe(error) : "ติดต่อระบบชำระเงินไม่ได้ กรุณาลองใหม่" };
      }
    },
    {
      body: t.Object({
        orderId: t.String({ format: "uuid" }),
        method: t.Union([t.Literal("promptpay"), t.Literal("card")]),
        token: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      }),
    }
  )

  /** Re-read the charge from Omise and reconcile. The checkout page polls this while a QR is shown. */
  .post(
    "/sync",
    async ({ body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบ" };
      }
      const [order] = await db.select(orderCols).from(orders).where(and(eq(orders.id, body.orderId), eq(orders.userId, user.id))).limit(1);
      if (!order) {
        set.status = 404;
        return { error: "ไม่พบคำสั่งซื้อ" };
      }
      if (order.status !== "pending" || order.gateway !== GATEWAY || !order.gatewayRef) {
        return { order: { id: order.id, status: order.status }, charge: null };
      }
      try {
        const charge = await getCharge(order.gatewayRef);
        const status = await applyCharge(order.id, charge);
        return { order: { id: order.id, status }, charge: publicCharge(charge) };
      } catch (error) {
        console.error("payments/sync:", describe(error));
        set.status = 502;
        return { error: "ตรวจสอบสถานะไม่ได้ กรุณาลองใหม่" };
      }
    },
    { body: t.Object({ orderId: t.String({ format: "uuid" }) }) }
  );

/**
 * Omise webhook (Dashboard → Webhooks → <PUBLIC_URL>/api/webhooks/omise).
 * Omise does not sign events, so the payload is only a hint: the charge is
 * re-fetched from the API before anything is written.
 */
export const webhookRoutes = new Elysia({ prefix: "/webhooks" }).post(
  "/omise",
  async ({ body }) => {
    const id = body.data?.id;
    if (!id || body.data?.object !== "charge" || !omiseConfigured()) return { ok: true, ignored: true };
    try {
      const charge = await getCharge(id);
      const orderId = charge.metadata?.order_id;
      const [order] = orderId
        ? await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).limit(1)
        : await db.select({ id: orders.id }).from(orders).where(and(eq(orders.gateway, GATEWAY), eq(orders.gatewayRef, charge.id))).limit(1);
      if (!order) return { ok: true, ignored: true };
      const status = await applyCharge(order.id, charge);
      return { ok: true, status };
    } catch (error) {
      console.error("webhooks/omise:", describe(error));
      return { ok: false };
    }
  },
  {
    body: t.Object(
      {
        key: t.Optional(t.String()),
        data: t.Optional(t.Object({ id: t.Optional(t.String()), object: t.Optional(t.String()) }, { additionalProperties: true })),
      },
      { additionalProperties: true }
    ),
  }
);
