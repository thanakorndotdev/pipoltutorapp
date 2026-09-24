import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "./db";
import { hostEnv } from "./db/env";
import { users, type UserRole } from "./db/schema";
import { SESSION_COOKIE, readCookie, userForToken, type SessionUser } from "./sessions";

export type { SessionUser } from "./sessions";

/**
 * Session resolution. The pt_session cookie (set by /auth/google/callback)
 * is the real path; the dev-only header below is a fallback for scripts.
 *
 * Dev auth is opt-in via ALLOW_DEV_AUTH=1 and must never be set in production:
 * it lets any caller act as any email address.
 */
const DEV_AUTH_ENABLED = hostEnv("ALLOW_DEV_AUTH") === "1";
const DEV_HEADER = "x-dev-user-email";

export async function currentUser(
  headers: Record<string, string | undefined>
): Promise<SessionUser | null> {
  const token = readCookie(headers, SESSION_COOKIE);
  if (token) {
    const user = await userForToken(token);
    if (user) return user;
  }

  if (!DEV_AUTH_ENABLED) return null;

  const email = headers[DEV_HEADER]?.trim().toLowerCase();
  if (!email) return null;

  const cols = { id: users.id, email: users.email, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role };
  const [existing] = await db.select(cols).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ googleId: `dev:${email}`, email, displayName: email })
    .returning(cols);
  return created ?? null;
}

/**
 * Bootstrap allow-list: comma-separated emails in ADMIN_EMAILS. The users.role
 * column is the source of truth; the list exists so the first admin can get in
 * before anyone has been promoted from the dashboard.
 */
const ADMIN_EMAILS = new Set(
  (hostEnv("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isBootstrapAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

/** Roles that open the admin panel. */
const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["admin", "dev"]);

export function isAdmin(user: SessionUser | null): boolean {
  return user !== null && (ADMIN_ROLES.has(user.role) || isBootstrapAdminEmail(user.email));
}

/**
 * Static admin API key for tooling and the admin settings page, sent as
 * `x-admin-key`. Empty ADMIN_API_KEY disables the header entirely.
 */
const ADMIN_API_KEY = hostEnv("ADMIN_API_KEY")?.trim() ?? "";
const ADMIN_KEY_HEADER = "x-admin-key";

export function hasAdminKey(
  headers: Record<string, string | undefined>
): boolean {
  if (!ADMIN_API_KEY) return false;
  const given = headers[ADMIN_KEY_HEADER]?.trim() ?? "";
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(ADMIN_API_KEY);
  // Length check first: timingSafeEqual throws on unequal lengths.
  return a.length === b.length && timingSafeEqual(a, b);
}
