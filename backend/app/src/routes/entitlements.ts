import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { Elysia } from "elysia";

import { currentUser } from "../auth";
import { db } from "../db";
import { entitlements, products, siteTexts, users } from "../db/schema";
import { SITE_TEXT_DEFAULTS } from "../site-texts";

const LINE_GROUP_KEY = "private.line_group_url";
const LINE_PUBLIC_KEY = "brand.line_url";

async function textValue(key: string): Promise<string> {
  const [row] = await db.select({ value: siteTexts.value }).from(siteTexts).where(eq(siteTexts.key, key)).limit(1);
  return (row?.value ?? SITE_TEXT_DEFAULTS[key] ?? "").trim();
}

/** Entitlements of this user that have not expired. */
function liveEntitlements(userId: string) {
  return and(
    eq(entitlements.userId, userId),
    or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date()))
  );
}

/**
 * What the signed-in user may open right now — live entitlement rows joined
 * to their product. Drives "already bought" states in the UI; every paid
 * route still checks the row itself.
 */
export const entitlementsRoutes = new Elysia({ prefix: "/entitlements" })
  .get("/", async ({ headers, set }) => {
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
      .where(liveEntitlements(user.id));
    return { entitlements: rows };
  })
  /**
   * The private LINE group invite, handed only to a buyer of a course or
   * exam product (a fortune reading does not count). The link lives in a
   * private site-text slot so it never appears in the public page source.
   * The first hand-off is stamped on users.lineInviteSentAt.
   */
  .get("/line-invite", async ({ headers, set }) => {
    const user = await currentUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "กรุณาเข้าสู่ระบบ" };
    }
    const [owned] = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .innerJoin(products, eq(products.id, entitlements.productId))
      .where(and(liveEntitlements(user.id), ne(products.kind, "fortune")))
      .limit(1);
    if (!owned) {
      set.status = 403;
      return { error: "ลิงก์กลุ่ม LINE เปิดให้เฉพาะผู้ที่ชำระเงินคอร์สหรือชุดข้อสอบแล้ว" };
    }
    const url = (await textValue(LINE_GROUP_KEY)) || (await textValue(LINE_PUBLIC_KEY));
    await db
      .update(users)
      .set({ lineInviteSentAt: new Date() })
      .where(and(eq(users.id, user.id), isNull(users.lineInviteSentAt)));
    return { url };
  });
