/**
 * Mints a login session for the Playwright suite in /e2e.
 * Upserts one user and prints a fresh session token as JSON on stdout —
 * nothing else is printed, so the caller can parse it directly.
 *
 * Defaults to a `test`-role user (paywall bypass, like a staff account).
 * The payment spec passes a throwaway email and `student` so entitlements
 * start empty and a successful charge visibly unlocks a pack.
 *
 * Run with: bun run e2e:session [email] [role]
 */
import { eq } from "drizzle-orm";

import { db, sql } from ".";
import { USER_ROLES, users, type UserRole } from "./schema";
import { createSession } from "../sessions";

const email = (process.argv[2] ?? "e2e@pipoltutor.test").toLowerCase();
const role = (process.argv[3] ?? "test") as UserRole;
if (!email.endsWith("@pipoltutor.test")) throw new Error(`refusing non-test email ${email}`);
if (!USER_ROLES.includes(role)) throw new Error(`unknown role ${role}`);

let [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
if (!user) {
  [user] = await db
    .insert(users)
    .values({ googleId: `e2e:${email}`, email, displayName: "E2E Tester", role })
    .returning({ id: users.id });
} else {
  await db.update(users).set({ role }).where(eq(users.id, user.id));
}

const { token, expiresAt } = await createSession(user!.id);
console.log(JSON.stringify({ token, expiresAt: expiresAt.toISOString(), email }));
await sql.end();
