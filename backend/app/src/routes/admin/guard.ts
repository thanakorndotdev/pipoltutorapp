import { Elysia } from "elysia";

import { currentUser, hasAdminKey, isAdmin } from "../../auth";

/**
 * Every /admin/* route hangs off this plugin. Admits a request carrying a
 * valid x-admin-key, or a session user listed in ADMIN_EMAILS. Nothing under
 * /admin is reachable by a student, so admin responses may include
 * questions.correctChoice — the one place it is allowed out of the DB.
 */
export const adminGuard = new Elysia({ name: "admin-guard" }).onBeforeHandle(
  { as: "scoped" },
  async ({ headers, set }) => {
    if (hasAdminKey(headers)) return;
    const user = await currentUser(headers);
    if (isAdmin(user)) return;
    set.status = 401;
    return { error: "ต้องใส่ API key ผู้ดูแลระบบ" };
  }
);
