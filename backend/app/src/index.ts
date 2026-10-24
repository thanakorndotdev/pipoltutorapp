import { Elysia } from "elysia";
import { count } from "drizzle-orm";

import { db, ping } from "./db";
import { products } from "./db/schema";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { campusesRoutes } from "./routes/campuses";
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

const port = Number(process.env.PORT ?? 3001);

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/health", async ({ set }) => {
    try {
      await ping();
      return { status: "ok", db: "up", version: APP_VERSION };
    } catch (error) {
      // The driver message can name the host, user or database; log it, don't serve it.
      console.error("health: db ping failed:", error instanceof Error ? error.message : String(error));
      set.status = 503;
      return { status: "degraded", db: "down", version: APP_VERSION };
    }
  })
  .get("/products", () =>
    db.select().from(products)
  )
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
  .use(adminRoutes)
  .use(uploadsRoutes)
  .use(siteRoutes)
  .use(adminSiteRoutes)
  .use(adminUploadsRoutes)
  .listen(port);

console.log(
  `🦊 PIPOL TUTOR API v${APP_VERSION} running at ${app.server?.hostname}:${app.server?.port}`
);
