import { Elysia } from "elysia";

import { PCSHS_CAMPUSES } from "../campuses";

/** Static list; the frontend uses it to populate the "จภ. ที่ต้องการสอบเข้า" dropdown. */
export const campusesRoutes = new Elysia({ prefix: "/campuses" }).get(
  "/",
  () => ({ campuses: PCSHS_CAMPUSES })
);
