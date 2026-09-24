import { cache } from "react";
import { cookies } from "next/headers";

import { BACKEND_URL } from "./api";

/** Cookie name shared with backend/app/src/sessions.ts and proxy.ts. */
export const SESSION_COOKIE = "pt_session";

export type SessionUser = { id: string; email: string; displayName: string | null; avatarUrl: string | null; role: "admin" | "dev" | "test" | "student" };

/**
 * Server components only. The session cookie as a fetch header for backend
 * calls whose answer depends on who is asking (e.g. exam-pack `unlocked`).
 * Empty when signed out, so the same call works anonymously.
 */
export async function sessionHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : {};
}

/**
 * Server components only. Forwards the session cookie to GET /auth/me; one
 * request per render thanks to cache(). Null when signed out or the backend
 * is unreachable — pages must render either way.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      cache: "no-store",
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` },
    });
    if (!res.ok) throw new Error(`GET /auth/me failed: ${res.status}`);
    return ((await res.json()) as { user: SessionUser | null }).user;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Dynamic server usage")) throw error;
    console.error("session lookup failed:", error);
    return null;
  }
});
