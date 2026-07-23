import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Server-side rate limit backed by Supabase Postgres.
 *
 * Returns true if the caller is still allowed, false if they've exceeded
 * `max` attempts within `windowSec` seconds. Failures in the rate-limit
 * layer itself fail *open* — we'd rather miss a rate-limit signal than
 * lock out a legitimate admin during an outage.
 */
export async function tryRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("try_rate_limit", {
      k: key,
      max_count: max,
      window_sec: windowSec,
    });
    if (error) {
      console.warn("rate_limit rpc error, failing open", error);
      return true;
    }
    return Boolean(data);
  } catch (e) {
    console.warn("rate_limit exception, failing open", e);
    return true;
  }
}

/**
 * Best-effort extract client IP from the request. Vercel populates
 * x-forwarded-for; behind other proxies it may not exist, so we fall back
 * to a shared "unknown" bucket which is fine — everyone hitting from an
 * unknown IP shares a rate-limit ceiling.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
