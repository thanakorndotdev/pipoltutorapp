import { Elysia, t } from "elysia";
import { asc, count, eq } from "drizzle-orm";

import { db } from "../../db";
import { entitlements, orders, products } from "../../db/schema";
import { adminGuard } from "./guard";

const productColumns = {
  id: products.id,
  slug: products.slug,
  kind: products.kind,
  title: products.title,
  description: products.description,
  priceSatang: products.priceSatang,
  active: products.active,
};

const idParam = t.Object({ id: t.String({ format: "uuid" }) });

/** Editable fields. slug and kind are fixed after creation: checkout links and pack/fortune logic key off them. */
const editable = {
  title: t.String({ minLength: 1, maxLength: 160 }),
  description: t.Union([t.String({ maxLength: 1000 }), t.Null()]),
  // Omise rejects charges under 20 THB; whole baht only.
  priceSatang: t.Integer({ minimum: 20_00, maximum: 1_000_000_00, multipleOf: 100 }),
  active: t.Boolean(),
};

const clean = (d: string | null) => d?.trim() || null;

/**
 * Price edits apply to orders created afterwards; an existing order keeps the
 * amountSatang it was created with.
 */
export const adminProductsRoutes = new Elysia({ prefix: "/admin/products" })
  .use(adminGuard)
  .get("/", async () => ({
    products: await db.select(productColumns).from(products).orderBy(asc(products.kind), asc(products.priceSatang)),
  }))
  .post(
    "/",
    async ({ body, set }) => {
      const [product] = await db
        .insert(products)
        .values({ ...body, title: body.title.trim(), description: clean(body.description) })
        .onConflictDoNothing({ target: products.slug })
        .returning(productColumns);
      if (!product) {
        set.status = 409;
        return { error: "slug นี้มีอยู่แล้ว" };
      }
      set.status = 201;
      return { product };
    },
    {
      body: t.Object({
        slug: t.String({ minLength: 1, maxLength: 80, pattern: "^[a-z0-9-]+$" }),
        kind: t.UnionEnum(["course", "exam_pack", "bundle", "fortune"]),
        ...editable,
      }),
    }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const [product] = await db
        .update(products)
        .set({ ...body, title: body.title.trim(), description: clean(body.description) })
        .where(eq(products.id, params.id))
        .returning(productColumns);
      if (!product) {
        set.status = 404;
        return { error: "ไม่พบสินค้า" };
      }
      return { product };
    },
    { params: idParam, body: t.Object(editable) }
  )
  /**
   * Only a product nobody has bought can go: orders restrict the delete, and
   * entitlements would cascade away and silently revoke a student's access.
   */
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [[o], [e]] = await Promise.all([
        db.select({ n: count() }).from(orders).where(eq(orders.productId, params.id)),
        db.select({ n: count() }).from(entitlements).where(eq(entitlements.productId, params.id)),
      ]);
      if (Number(o?.n ?? 0) > 0 || Number(e?.n ?? 0) > 0) {
        set.status = 409;
        return { error: "สินค้านี้มีคำสั่งซื้อหรือสิทธิ์ของนักเรียนแล้ว ลบไม่ได้ ใช้ “ปิดขาย” แทน" };
      }
      const deleted = await db.delete(products).where(eq(products.id, params.id)).returning({ id: products.id });
      if (deleted.length === 0) {
        set.status = 404;
        return { error: "ไม่พบสินค้า" };
      }
      return { ok: true };
    },
    { params: idParam }
  );
