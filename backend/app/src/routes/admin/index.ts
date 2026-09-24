import { Elysia } from "elysia";

import { adminPacksRoutes } from "./packs";
import { adminProductsRoutes } from "./products";
import { adminQuestionsRoutes } from "./questions";
import { adminStatsRoutes } from "./stats";
import { adminUsersRoutes } from "./users";

export const adminRoutes = new Elysia()
  .use(adminStatsRoutes)
  .use(adminQuestionsRoutes)
  .use(adminPacksRoutes)
  .use(adminProductsRoutes)
  .use(adminUsersRoutes);
