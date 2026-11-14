import { examActivityRoutes } from "./routes/exam-activity";
import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
import { DomainError } from "./features/common";
import { errorLogs } from "./db/features";
import { publicUrl } from "./sessions";
import { attachmentsRoutes, adminMediaRoutes } from "./routes/media";
import { homeRoutes, moduleHealthRoutes } from "./routes/home";
import { dailyRoutes } from "./routes/daily";
import { lifecycleRoutes } from "./routes/lifecycle";
import { count } from "drizzle-orm";

import { db, ping } from "./db";
import { products } from "./db/schema";
import { adminRoutes } from "./routes/admin";
import { articlesRoutes } from "./routes/articles";
import { authRoutes } from "./routes/auth";
import { campusesRoutes } from "./routes/campuses";
import { startCertificateWorker } from "./certificates/worker";
import { certificatesRoutes, certVerifyRoutes } from "./routes/certificates";
import { notificationsRoutes } from "./routes/notifications";
import { entitlementsRoutes } from "./routes/entitlements";
import { attemptsRoutes, examPacksRoutes } from "./routes/exam";
import { fortuneRoutes } from "./routes/fortune";
import { ordersRoutes } from "./routes/orders";
import { paymentsRoutes, webhookRoutes } from "./routes/payments";
import { profileRoutes } from "./routes/profile";
import { settingsRoutes } from "./routes/settings";
import { adminSiteRoutes, siteRoutes } from "./routes/site";
import { adminUploadsRoutes, uploadsRoutes } from "./routes/uploads";
import { APP_VERSION } from "./version";

export const app = new Elysia()
  .onError(async ({ error, set, code }) => {
    if (error instanceof DomainError) {
      set.status = error.status;
      return { error: error.message };
    }
    if (code === "VALIDATION") {
      set.status = 422;
      return { error: "ข้อมูลไม่ตรงรูปแบบที่กำหนด" };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "ไม่พบข้อมูล" };
    }
    const requestId = randomUUID();
    await db
      .insert(errorLogs)
      .values({
        module: "api",
        code: String(code),
        requestId,
        message: "การดำเนินการไม่สำเร็จ โปรดตรวจสอบบริการและฐานข้อมูล",
      })
      .catch(() => {});
    console.error(
      `request ${requestId}:`,
      error instanceof Error ? error.name : "internal error",
    );
    set.status = 500;
    return { error: "ระบบขัดข้อง กรุณาลองใหม่", requestId };
  })
  .onBeforeHandle(({ request, headers, set }) => {
    if (
      ["GET", "HEAD", "OPTIONS"].includes(request.method) ||
      new URL(request.url).pathname.startsWith("/webhooks/")
    )
      return;
    if (headers.origin) {
      const allowed = new Set([
        new URL(publicUrl()).origin,
        new URL(request.url).origin,
      ]);
      if (process.env.NODE_ENV !== "production") {
        allowed.add("http://localhost:3000");
        allowed.add("http://localhost:3002");
      }
      if (!allowed.has(headers.origin)) {
        set.status = 403;
        return { error: "แหล่งที่มาของคำขอไม่ถูกต้อง" };
      }
    }
  })
  .onAfterHandle(({ request, set }) => {
    if (!/^\/(uploads|attachments)\//.test(new URL(request.url).pathname))
      set.headers["cache-control"] = "no-store";
    set.headers["x-content-type-options"] = "nosniff";
  })
  .use(attachmentsRoutes)
  .use(adminMediaRoutes)
  .use(homeRoutes)
  .use(moduleHealthRoutes)
  .use(dailyRoutes)
  .use(lifecycleRoutes)
  .get("/", () => "Hello Elysia")
  .get("/health", async ({ set }) => {
    try {
      await ping();
      return { status: "ok", db: "up", version: APP_VERSION };
    } catch (error) {
      // The driver message can name the host, user or database; log it, don't serve it.
      console.error(
        "health: db ping failed:",
        error instanceof Error ? error.message : String(error),
      );
      set.status = 503;
      return { status: "degraded", db: "down", version: APP_VERSION };
    }
  })
  .get("/products", () => db.select().from(products))
  .get("/products/count", async () => {
    const [row] = await db.select({ total: count() }).from(products);
    return { total: row?.total ?? 0 };
  })
  .use(authRoutes)
  .use(campusesRoutes)
  .use(ordersRoutes)
  .use(entitlementsRoutes)
  .use(fortuneRoutes)
  .use(paymentsRoutes)
  .use(webhookRoutes)
  .use(settingsRoutes)
  .use(profileRoutes)
  .use(examPacksRoutes)
  .use(attemptsRoutes)
  .use(examActivityRoutes)
  .use(certificatesRoutes)
  .use(certVerifyRoutes)
  .use(notificationsRoutes)
  .use(articlesRoutes)
  .use(adminRoutes)
  .use(uploadsRoutes)
  .use(siteRoutes)
  .use(adminSiteRoutes)
  .use(adminUploadsRoutes);
