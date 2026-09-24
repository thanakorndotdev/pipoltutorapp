"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 4000;
/** Stop after 10 minutes; a PromptPay QR has expired by then and the page says so on reload. */
const GIVE_UP_MS = 10 * 60 * 1000;

/**
 * Mounted by a server page that rendered an order as still pending — e.g. the
 * browser came back from Omise's authorize step a moment before the charge
 * settled. Re-reads the charge via /api/payments/sync and re-renders the page
 * once it leaves `pending`, so a paid customer is never left on "waiting".
 */
export function PendingPaymentWatcher({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    const started = Date.now();
    let stopped = false;
    const id = window.setInterval(async () => {
      if (stopped) return;
      if (Date.now() - started > GIVE_UP_MS) {
        window.clearInterval(id);
        return;
      }
      try {
        const res = await fetch("/api/payments/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { order?: { status?: string } };
        if (data.order?.status && data.order.status !== "pending") {
          stopped = true;
          window.clearInterval(id);
          router.refresh();
        }
      } catch {
        /* transient; next tick retries */
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [orderId, router]);

  return null;
}
