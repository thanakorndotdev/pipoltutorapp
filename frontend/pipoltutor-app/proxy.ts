import { NextResponse, type NextRequest } from "next/server";

/**
 * Session cookie set by the Google OAuth callback. Its presence is only a
 * hint; pages still check the session with the backend.
 */
export const SESSION_COOKIE = "pt_session";

/** Routes that need a signed-in user. /exam requires Google login before anything else. */
const GATED = ["/fortune", "/dashboard", "/checkout", "/exam", "/profile"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if(/^\/articles\/[^/]+\/?$/.test(pathname)){try{const slug=pathname.split("/")[2];const r=await fetch(`${process.env.BACKEND_URL??"http://localhost:3001"}/articles/${encodeURIComponent(slug)}`,{redirect:"manual",cache:"no-store"});
    if(r.status===301){const body=await r.json();if(typeof body.redirect==="string"&&/^[a-z0-9-]+$/.test(body.redirect))return NextResponse.redirect(new URL(`/articles/${body.redirect}`,request.url),301);}
    if(r.status===410)return new NextResponse('<!doctype html><html lang="th"><meta charset="utf-8"><title>บทความถูกนำออกแล้ว</title><body><h1>บทความนี้ถูกนำออกแล้ว</h1><a href="/articles">กลับไปอ่านบทความอื่น</a></body></html>',{status:410,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
  }catch{}return NextResponse.next();}
  if (!GATED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/articles/:path*","/fortune/:path*", "/dashboard/:path*", "/checkout/:path*", "/exam/:path*", "/exam", "/profile"],
};
