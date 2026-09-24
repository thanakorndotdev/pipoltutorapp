import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { hostEnv } from "../db/env";
import { entitlements, orders } from "../db/schema";
import { publicUrl } from "../sessions";

/**
 * Omise (Opn Payments) over plain fetch — no SDK. Secret key stays here;
 * the public key goes to the browser only for card tokenisation (Omise.js).
 *
 * Money: orders.amountSatang is already the integer minor unit Omise wants
 * for THB ("amount": 490000 = ฿4,900).
 */
const API = "https://api.omise.co";
const CURRENCY = "THB";

export const GATEWAY = "omise";

export function omisePublicKey(): string {
  return hostEnv("OMISE_PUBLIC_KEY")?.trim() ?? "";
}
function secretKey(): string {
  return hostEnv("OMISE_SECRET_KEY")?.trim() ?? "";
}
export function omiseConfigured(): boolean {
  return Boolean(omisePublicKey() && secretKey());
}

/** Where Omise sends the browser back after PromptPay / 3-D Secure. */
export function returnUri(orderId: string): string {
  return `${publicUrl()}/checkout/success?order=${encodeURIComponent(orderId)}`;
}

export type OmiseCharge = {
  object: "charge";
  id: string;
  status: "pending" | "successful" | "failed" | "expired" | "reversed" | string;
  paid: boolean;
  amount: number;
  currency: string;
  failure_code?: string | null;
  failure_message?: string | null;
  authorize_uri?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, string>;
  card?: { brand?: string; last_digits?: string } | null;
  source?: {
    id: string;
    type: string;
    scannable_code?: { image?: { download_uri?: string } } | null;
  } | null;
};

type OmiseError = { object: "error"; code: string; message: string };

export class OmiseApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function omise<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString("base64")}`,
      "content-type": "application/json",
      "omise-version": "2019-05-29",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T | OmiseError;
  if (!res.ok || (data as OmiseError).object === "error") {
    const e = data as OmiseError;
    throw new OmiseApiError(res.status, e.code ?? "unknown", e.message ?? `Omise ${path} failed (${res.status})`);
  }
  return data as T;
}

type OrderRow = { id: string; amountSatang: number; userId: string; productId: string };

/**
 * One request: the promptpay source is created inline with the charge. The
 * QR image to show the customer is charge.source.scannable_code.image.download_uri
 * (exposed to the browser as qrImageUrl by publicCharge).
 */
export async function createPromptPayCharge(order: OrderRow): Promise<OmiseCharge> {
  return omise<OmiseCharge>("/charges", {
    amount: order.amountSatang,
    currency: CURRENCY,
    source: { type: "promptpay" },
    return_uri: returnUri(order.id),
    metadata: { order_id: order.id },
  });
}

/** `token` is a tokn_… from Omise.js; the card number never reaches this server. */
export async function createCardCharge(order: OrderRow, token: string): Promise<OmiseCharge> {
  return omise<OmiseCharge>("/charges", {
    amount: order.amountSatang,
    currency: CURRENCY,
    card: token,
    return_uri: returnUri(order.id),
    metadata: { order_id: order.id },
  });
}

export function getCharge(id: string): Promise<OmiseCharge> {
  return omise<OmiseCharge>(`/charges/${encodeURIComponent(id)}`);
}

/** What the browser is allowed to know about a charge. */
export function publicCharge(c: OmiseCharge) {
  return {
    id: c.id,
    status: c.status,
    paid: c.paid,
    method: c.source?.type ?? (c.card ? "card" : "unknown"),
    qrImageUrl: c.source?.scannable_code?.image?.download_uri ?? null,
    authorizeUri: c.authorize_uri ?? null,
    expiresAt: c.expires_at ?? null,
    failureMessage: c.failure_message ?? null,
    card: c.card ? { brand: c.card.brand ?? null, lastDigits: c.card.last_digits ?? null } : null,
  };
}

/**
 * Reconcile an order with a charge Omise reported. Idempotent: a paid order
 * stays paid, and the entitlement insert ignores duplicates. Only a pending
 * order can move, so a late "failed" cannot undo a payment.
 */
export async function applyCharge(orderId: string, charge: OmiseCharge): Promise<"pending" | "paid" | "failed" | "refunded"> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status, userId: orders.userId, productId: orders.productId, amountSatang: orders.amountSatang })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) throw new Error(`order ${orderId} not found for charge ${charge.id}`);

    const patch = { gateway: GATEWAY, gatewayRef: charge.id, gatewayPayload: charge as unknown as Record<string, unknown> };

    if (order.status === "paid") {
      await tx.update(orders).set(patch).where(eq(orders.id, order.id));
      return "paid";
    }
    if (order.status !== "pending") return order.status;

    const success = charge.status === "successful" && charge.paid && charge.amount === order.amountSatang && charge.currency.toUpperCase() === CURRENCY;
    if (success) {
      await tx.update(orders).set({ ...patch, status: "paid", paidAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.status, "pending")));
      await tx
        .insert(entitlements)
        .values({ userId: order.userId, productId: order.productId, orderId: order.id })
        .onConflictDoNothing({ target: [entitlements.userId, entitlements.productId] });
      return "paid";
    }
    if (charge.status === "failed" || charge.status === "expired" || charge.status === "reversed") {
      await tx.update(orders).set({ ...patch, status: "failed" }).where(and(eq(orders.id, order.id), eq(orders.status, "pending")));
      return "failed";
    }
    await tx.update(orders).set(patch).where(eq(orders.id, order.id));
    return "pending";
  });
}
