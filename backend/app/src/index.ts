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
import { settingsRoutes } from "./routes/settings";
import { adminSiteRoutes, siteRoutes } from "./routes/site";
import { adminUploadsRoutes, uploadsRoutes } from "./routes/uploads";

const port = Number(process.env.PORT ?? 3001);

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/health", async ({ set }) => {
    try {
      await ping();
      return { status: "ok", db: "up" };
    } catch (error) {
      set.status = 503;
      return {
        status: "degraded",
        db: "down",
        error: error instanceof Error ? error.message : String(error),
      };
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
  .use(examPacksRoutes)
  .use(attemptsRoutes)
  .use(adminRoutes)
  .use(uploadsRoutes)
  .use(siteRoutes)
  .use(adminSiteRoutes)
  .use(adminUploadsRoutes)
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
