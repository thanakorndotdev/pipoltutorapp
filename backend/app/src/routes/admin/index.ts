import { Elysia } from "elysia";

import { adminPacksRoutes } from "./packs";
import { adminProductsRoutes } from "./products";
import { adminQuestionsRoutes } from "./questions";
import { adminResultsRoutes } from "./results";
import { adminStatsRoutes } from "./stats";
import { adminUsersRoutes } from "./users";

export const adminRoutes = new Elysia()
  .use(adminStatsRoutes)
  .use(adminQuestionsRoutes)
  .use(adminPacksRoutes)
  .use(adminResultsRoutes)
  .use(adminProductsRoutes)
  .use(adminUsersRoutes);
