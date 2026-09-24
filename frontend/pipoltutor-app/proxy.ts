import { NextResponse, type NextRequest } from "next/server";

/**
 * Session cookie the future Google OAuth callback will set. Until it lands
 * nobody has it, so the gated routes below always bounce to /login — which
 * is the intended behaviour: ดูดวง is for signed-in students only.
 */
export const SESSION_COOKIE = "pt_session";

/** Routes that need a signed-in user. Exam stays open for the free-trial flow. */
const GATED = ["/fortune", "/dashboard", "/checkout"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!GATED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/fortune/:path*", "/dashboard/:path*", "/checkout/:path*"],
};
