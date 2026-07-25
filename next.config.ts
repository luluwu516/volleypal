import type { NextConfig } from "next";
// Fail the build (and every server cold-start) with a clear message if a
// required env var is missing or malformed, instead of dying later inside a
// request handler with a cryptic message.
import { env } from "./lib/env";
env();

// Baseline defense-in-depth headers. Skipping CSP for now — Next.js relies
// on inline scripts + hydration bootstrap that would require nonce-based CSP
// through middleware. The other headers below have no downside.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Deny sensor / camera / mic. Geolocation isn't used by the app itself —
    // NavigateButton delegates to Apple/Google Maps which run on their own
    // origin with their own permissions.
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
