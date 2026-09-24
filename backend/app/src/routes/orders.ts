import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";

import { currentUser } from "../auth";
import { PCSHS_CAMPUS_CODES } from "../campuses";
import { db } from "../db";
import { orders, products } from "../db/schema";

/** Thai mobile number: 10 digits starting with 0, dashes/spaces allowed. */
const PHONE_RE = /^0\d{9}$/;
/** Instagram handle rules: 1–30 of letters, digits, "." or "_". */
const INSTAGRAM_RE = /^[A-Za-z0-9._]{1,30}$/;

const createOrderBody = t.Object({
  productId: t.String({ format: "uuid" }),
  studentName: t.String({ minLength: 1, maxLength: 120 }),
  currentSchool: t.String({ minLength: 1, maxLength: 160 }),
  targetCampus: t.UnionEnum(PCSHS_CAMPUS_CODES),
  /** Accepted with or without a leading "@"; stored without it. */
  studentInstagram: t.String({ maxLength: 31 }),
  parentPhone: t.String({ minLength: 9, maxLength: 20 }),
  receiptEmail: t.String({ format: "email", maxLength: 254 }),
});

const orderColumns = {
  id: orders.id,
  productId: orders.productId,
  status: orders.status,
  amountSatang: orders.amountSatang,
  studentName: orders.studentName,
  currentSchool: orders.currentSchool,
  targetCampus: orders.targetCampus,
  studentInstagram: orders.studentInstagram,
  parentPhone: orders.parentPhone,
  receiptEmail: orders.receiptEmail,
  gateway: orders.gateway,
  paidAt: orders.paidAt,
  createdAt: orders.createdAt,
  // gatewayRef and gatewayPayload stay server-side on purpose.
};

export const ordersRoutes = new Elysia({ prefix: "/orders" })
  .post(
    "/",
    async ({ body, headers, set }) => {
      const user = await currentUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "กรุณาเข้าสู่ระบบก่อนสมัครคอร์ส" };
      }

      const parentPhone = body.parentPhone.replace(/[\s-]/g, "");
      if (!PHONE_RE.test(parentPhone)) {
        set.status = 422;
        return { error: "เบอร์ผู้ปกครองต้องเป็นเบอร์มือถือ 10 หลัก" };
      }

      const studentInstagram = body.studentInstagram.trim().replace(/^@/, "");
      if (studentInstagram && !INSTAGRAM_RE.test(studentInstagram)) {
        set.status = 422;
        return { error: "Instagram ใช้ได้เฉพาะ a-z, 0-9, จุด และขีดล่าง" };
      }

      const [product] = await db
        .select({ id: products.id, priceSatang: products.priceSatang })
        .from(products)
        .where(and(eq(products.id, body.productId), eq(products.active, true)))
        .limit(1);
      if (!product) {
        set.status = 404;
        return { error: "ไม่พบคอร์สที่เลือก" };
      }

      const [order] = await db
        .insert(orders)
        .values({
          userId: user.id,
          productId: product.id,
          amountSatang: product.priceSatang,
          studentName: body.studentName.trim(),
          currentSchool: body.currentSchool.trim(),
          targetCampus: body.targetCampus,
          studentInstagram: studentInstagram || null,
          parentPhone,
          receiptEmail: body.receiptEmail.trim().toLowerCase(),
        })
        .returning(orderColumns);

      set.status = 201;
      return { order };
    },
    { body: createOrderBody }
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
      const [order] = await db
        .select(orderColumns)
        .from(orders)
        .where(and(eq(orders.id, params.id), eq(orders.userId, user.id)))
        .limit(1);
      if (!order) {
        set.status = 404;
        return { error: "ไม่พบคำสั่งซื้อ" };
      }
      return { order };
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) }
  );
