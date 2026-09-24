import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";

import { db } from "./db";
import { hostEnv } from "./db/env";
import { sessions, users, type UserRole } from "./db/schema";

export const SESSION_COOKIE = "pt_session";
export const SESSION_DAYS = 30;

/** Origin the browser uses (Caddy in Docker, next dev on the host). Drives redirect_uri + cookie Secure. */
export function publicUrl(): string {
  return (hostEnv("PUBLIC_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function cookieSecure(): boolean {
  return publicUrl().startsWith("https://");
}

export type SessionUser = { id: string; email: string; displayName: string | null; avatarUrl: string | null; role: UserRole };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Minimal Cookie header parser; values are URI-decoded, first occurrence wins. */
export function readCookie(headers: Record<string, string | undefined>, name: string): string | undefined {
  const raw = headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return part.slice(i + 1).trim();
    }
  }
  return undefined;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function userForToken(token: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
