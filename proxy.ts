import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy: protects /admin/* (except /admin/login) by checking that
 * the iron-session cookie exists. We do NOT decode the cookie here because
 * iron-session needs Node crypto APIs — actual validation happens in the
 * route handler / page via getAdminSession(). The cookie presence check is
 * just a fast bounce.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  const cookie = req.cookies.get("volleypal_admin");
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
