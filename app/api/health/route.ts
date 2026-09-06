import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Uptime probe endpoint. Point Better Stack / UptimeRobot / any other
 * monitor at this and it'll email you when the site or its DB stops
 * responding.
 *
 * Checks:
 *   - server is up (implicit — we responded)
 *   - Supabase reachable via a cheap count query
 *
 * Rate-limited per IP so a scraper can't burn Supabase quota. 12/min is well
 * above what any monitor needs (usually 1/min) but tight enough to stop a
 * loop from doing damage. Over-limit still returns 200 so uptime monitors
 * don't page on their own noise.
 */
export async function GET(req: Request) {
  if (!(await tryRateLimit(`health:${clientIp(req)}`, 12, 60))) {
    return NextResponse.json({ ok: true, throttled: true });
  }
  const started = Date.now();
  try {
    const { error } = await supabaseAdmin()
      .from("tournaments")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      db_ms: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "unknown",
      },
      { status: 503 },
    );
  }
}
