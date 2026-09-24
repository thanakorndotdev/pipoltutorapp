import { cookies } from "next/headers";

import { BACKEND_URL } from "./api";
import { SESSION_COOKIE } from "./auth";
import type { PcshsCampusCode } from "./campuses";

export type Order = {
  id: string;
  productId: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amountSatang: number;
  studentName: string | null;
  currentSchool: string | null;
  targetCampus: PcshsCampusCode | null;
  studentInstagram: string | null;
  parentPhone: string | null;
  receiptEmail: string | null;
  gateway: string | null;
  paidAt: string | null;
  createdAt: string;
};

async function sessionHeader(): Promise<Record<string, string> | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : null;
}

/** Server components: the caller's own order, or null (signed out, not theirs, unreachable). */
export async function fetchMyOrder(id: string): Promise<Order | null> {
  const h = await sessionHeader();
  if (!h) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/orders/${encodeURIComponent(id)}`, { cache: "no-store", headers: h });
    if (!res.ok) return null;
    return ((await res.json()) as { order: Order }).order;
  } catch {
    return null;
  }
}

/**
 * Ask the backend to re-read the charge from the gateway. Used when the
 * browser lands on the success page straight from Omise (3-D Secure /
 * PromptPay return) before the webhook has necessarily arrived.
 */
export async function syncMyOrder(id: string): Promise<void> {
  const h = await sessionHeader();
  if (!h) return;
  try {
    await fetch(`${BACKEND_URL}/payments/sync`, {
      method: "POST",
      cache: "no-store",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
  } catch {
    /* the page renders the last known status */
  }
}

export type Entitlement = {
  productId: string;
  productSlug: string;
  productKind: "course" | "exam_pack" | "bundle" | "fortune";
  grantedAt: string;
  expiresAt: string | null;
};

/** Server components: the caller's live entitlements; empty when signed out or unreachable. */
export async function fetchMyEntitlements(): Promise<Entitlement[]> {
  const h = await sessionHeader();
  if (!h) return [];
  try {
    const res = await fetch(`${BACKEND_URL}/entitlements`, { cache: "no-store", headers: h });
    if (!res.ok) return [];
    return ((await res.json()) as { entitlements: Entitlement[] }).entitlements;
  } catch {
    return [];
  }
}
