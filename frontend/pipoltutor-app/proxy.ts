import { NextResponse, type NextRequest } from "next/server";

/**
 * Session cookie set by the Google OAuth callback. Its presence is only a
 * hint; pages still check the session with the backend.
 */
export const SESSION_COOKIE = "pt_session";

/** Routes that need a signed-in user. /exam requires Google login before anything else. */
const GATED = ["/fortune", "/dashboard", "/checkout", "/exam", "/profile"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!GATED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/fortune/:path*", "/dashboard/:path*", "/checkout/:path*", "/exam/:path*", "/exam", "/profile"],
};
