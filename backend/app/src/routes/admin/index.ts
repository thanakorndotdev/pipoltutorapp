import { Elysia } from "elysia";

import { adminArticlesRoutes,adminCmsRoutes,adminCommentsRoutes } from "./articles";
import { adminRankingRoutes } from "./ranking";
import { adminDailyRoutes } from "./daily";
import { adminOperationsRoutes } from "./operations";
import { adminCertificatesRoutes, adminCertTemplatesRoutes } from "./certificates";
import { adminPacksRoutes } from "./packs";
import { adminProductsRoutes } from "./products";
import { adminQuestionsRoutes } from "./questions";
import { adminResultsRoutes } from "./results";
import { adminStatsRoutes } from "./stats";
import { adminUsersRoutes } from "./users";

export const adminRoutes = new Elysia()
  .use(adminRankingRoutes)
  .use(adminDailyRoutes)
  .use(adminOperationsRoutes)
  .use(adminCmsRoutes)
  .use(adminCommentsRoutes)
  .use(adminStatsRoutes)
  .use(adminQuestionsRoutes)
  .use(adminPacksRoutes)
  .use(adminResultsRoutes)
  .use(adminProductsRoutes)
  .use(adminArticlesRoutes)
  .use(adminCertificatesRoutes)
  .use(adminCertTemplatesRoutes)
  .use(adminUsersRoutes);
