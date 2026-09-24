import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { currentUser, isBootstrapAdminEmail } from "../auth";
import { db } from "../db";
import { hostEnv } from "../db/env";
import { users } from "../db/schema";
import { SESSION_COOKIE, SESSION_DAYS, cookieSecure, createSession, deleteSession, publicUrl, readCookie } from "../sessions";

/**
 * Google OAuth 2.0 (authorization code) without a client library.
 *
 * Browser path is /api/auth/* (Caddy / next dev strip /api before we see it),
 * so cookies scoped to the OAuth handshake use Path=/api/auth and the
 * redirect_uri registered in Google Cloud must be
 *   <PUBLIC_URL>/api/auth/google/callback
 * e.g. http://localhost:3000/api/auth/google/callback for the host dev loop.
 */
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_COOKIE = "pt_oauth";
const STATE_TTL_SECONDS = 600;

function clientId(): string {
  return hostEnv("GOOGLE_CLIENT_ID")?.trim() ?? "";
}
function clientSecret(): string {
  return hostEnv("GOOGLE_CLIENT_SECRET")?.trim() ?? "";
}
function redirectUri(): string {
  return `${publicUrl()}/api/auth/google/callback`;
}

/**
 * Only same-site paths are honoured as a post-login destination. Parsing with
 * the URL parser (not prefix checks) catches `/\evil.com` and tab/newline
 * tricks that browsers normalise into a protocol-relative `//evil.com`.
 */
function safeNext(next: string | undefined): string {
  const fallback = "/dashboard";
  if (!next || !next.startsWith("/")) return fallback;
  const base = new URL(publicUrl());
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base.origin || url.pathname.startsWith("/api/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

type CookieAttrs = { path: string; maxAge: number; expires?: Date };

function serializeCookie(name: string, value: string, a: CookieAttrs): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${a.path}`, `Max-Age=${a.maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (a.expires) parts.push(`Expires=${a.expires.toUTCString()}`);
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

/** A Response carrying several Set-Cookie headers (Elysia's set.headers holds one value per name). */
function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

type GoogleTokens = { access_token?: string; error?: string; error_description?: string };
type GoogleProfile = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

export const authRoutes = new Elysia({ prefix: "/auth" })
  /** Who is signed in, or null. The frontend layout calls this once per request. */
  .get("/me", async ({ headers }) => ({ user: await currentUser(headers) }))

  .get(
    "/google",
    ({ query, set }) => {
      if (!clientId() || !clientSecret()) {
        // Browser-initiated, so bounce back to the login page with a reason
        // rather than showing raw JSON.
        set.status = 302;
        set.headers.location = "/login?error=not_configured";
        return;
      }
      const state = randomBytes(16).toString("base64url");
      const next = safeNext(query.next);
      const url = new URL(GOOGLE_AUTH);
      url.searchParams.set("client_id", clientId());
      url.searchParams.set("redirect_uri", redirectUri());
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "select_account");
      return redirectWithCookies(url.toString(), [
        serializeCookie(STATE_COOKIE, `${state}.${encodeURIComponent(next)}`, { path: "/api/auth", maxAge: STATE_TTL_SECONDS }),
      ]);
    },
    { query: t.Object({ next: t.Optional(t.String({ maxLength: 500 })) }) }
  )

  .get(
    "/google/callback",
    async ({ query, headers, set }) => {
      const clearState = serializeCookie(STATE_COOKIE, "", { path: "/api/auth", maxAge: 0 });
      const fail = (reason: string) => redirectWithCookies(`/login?error=${encodeURIComponent(reason)}`, [clearState]);

      const stored = readCookie(headers, STATE_COOKIE);
      const dot = stored?.indexOf(".") ?? -1;
      if (!stored || dot < 0) return fail("state_missing");
      const [state, nextRaw] = [stored.slice(0, dot), stored.slice(dot + 1)];
      if (query.error) return fail(query.error);
      if (!query.code || !query.state || query.state !== state) return fail("state_mismatch");

      let tokens: GoogleTokens;
      try {
        const r = await fetch(GOOGLE_TOKEN, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: query.code,
            client_id: clientId(),
            client_secret: clientSecret(),
            redirect_uri: redirectUri(),
            grant_type: "authorization_code",
          }),
        });
        tokens = (await r.json()) as GoogleTokens;
        if (!r.ok || !tokens.access_token) {
          console.error("google token exchange failed:", tokens.error, tokens.error_description);
          return fail("token_exchange");
        }
      } catch (error) {
        console.error("google token exchange error:", error instanceof Error ? error.message : String(error));
        return fail("token_exchange");
      }

      let profile: GoogleProfile;
      try {
        const r = await fetch(GOOGLE_USERINFO, { headers: { authorization: `Bearer ${tokens.access_token}` } });
        if (!r.ok) return fail("userinfo");
        profile = (await r.json()) as GoogleProfile;
      } catch {
        return fail("userinfo");
      }
      const email = profile.email?.trim().toLowerCase();
      if (!profile.sub || !email || profile.email_verified === false) return fail("email_unverified");

      // Match by Google id first, then by email (a dev-auth row keeps its data and gains the real id).
      const cols = { id: users.id };
      const [byGoogle] = await db.select(cols).from(users).where(eq(users.googleId, profile.sub)).limit(1);
      const [byEmail] = byGoogle ? [] : await db.select(cols).from(users).where(eq(users.email, email)).limit(1);
      const patch = { googleId: profile.sub, email, displayName: profile.name ?? null, avatarUrl: profile.picture ?? null, updatedAt: new Date() };
      let userId: string;
      if (byGoogle ?? byEmail) {
        userId = (byGoogle ?? byEmail)!.id;
        await db.update(users).set(patch).where(eq(users.id, userId));
      } else {
        // New accounts are students; ADMIN_EMAILS only seeds the very first admins.
        const role = isBootstrapAdminEmail(email) ? "admin" : "student";
        const [created] = await db.insert(users).values({ ...patch, role }).returning(cols);
        if (!created) return fail("user_create");
        userId = created.id;
      }

      const { token, expiresAt } = await createSession(userId);
      return redirectWithCookies(safeNext(decodeURIComponent(nextRaw)), [
        clearState,
        serializeCookie(SESSION_COOKIE, token, { path: "/", maxAge: SESSION_DAYS * 86_400, expires: expiresAt }),
      ]);
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
        scope: t.Optional(t.String()),
        authuser: t.Optional(t.String()),
        prompt: t.Optional(t.String()),
        hd: t.Optional(t.String()),
      }),
    }
  )

  /** Drops the current session and clears the cookie. */
  .post("/logout", async ({ headers }) => {
    const token = readCookie(headers, SESSION_COOKIE);
    if (token) await deleteSession(token);
    const h = new Headers({ "content-type": "application/json" });
    h.append("set-cookie", serializeCookie(SESSION_COOKIE, "", { path: "/", maxAge: 0 }));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
  });
