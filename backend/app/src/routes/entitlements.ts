import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Elysia } from "elysia";

import { currentUser } from "../auth";
import { db } from "../db";
import { entitlements, products } from "../db/schema";

/**
 * What the signed-in user may open right now — live entitlement rows joined
 * to their product. Drives "already bought" states in the UI; every paid
 * route still checks the row itself.
 */
export const entitlementsRoutes = new Elysia({ prefix: "/entitlements" }).get("/", async ({ headers, set }) => {
  const user = await currentUser(headers);
  if (!user) {
    set.status = 401;
    return { error: "กรุณาเข้าสู่ระบบ" };
  }
  const rows = await db
    .select({
      productId: entitlements.productId,
      productSlug: products.slug,
      productKind: products.kind,
      grantedAt: entitlements.grantedAt,
      expiresAt: entitlements.expiresAt,
    })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .where(
      and(
        eq(entitlements.userId, user.id),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date()))
      )
    );
  return { entitlements: rows };
});
