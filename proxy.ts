import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy: does two things per request.
 *
 * 1. Injects a nonce-based Content Security Policy. Nonce is randomised
 *    per request and exposed via the `x-nonce` header so Next/React can
 *    stamp it on the inline hydration scripts. `strict-dynamic` lets
 *    those bootstrap scripts pull chunks in without whitelisting every
 *    URL. Inline styles remain permitted because Next has no nonce path
 *    for CSS.
 *
 * 2. Bounces unauthenticated hits on /admin/* (except /admin/login) to
 *    the login page. Cookie-presence check only — full session validation
 *    happens later via getAdminSession() (iron-session needs Node crypto
 *    APIs not available at the edge).
 */

const CSP_EXCLUDE_PATH = /^\/(_next\/static|_next\/image|favicon|icon|apple-touch-icon|logo|manifest|sw\.js|offline)/;

function buildCsp(nonce: string): string {
  // Dev only: React uses eval() to reconstruct callstacks for dev-mode error
  // overlays and debugging. Prod builds don't use eval and this stays out.
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin auth bounce.
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const cookie = req.cookies.get("volleypal_admin");
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // CSP injection — skip static/PWA assets (no injectable surface anyway).
  if (CSP_EXCLUDE_PATH.test(pathname)) {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Match everything except API routes (they don't render HTML) and let the
  // handler skip static assets internally.
  matcher: ["/((?!api).*)"],
};
