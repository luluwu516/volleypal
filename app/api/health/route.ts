import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Uptime probe endpoint. Point Better Stack / UptimeRobot / any other
 * monitor at this and it'll email you when the site or its DB stops
 * responding.
 *
 * Checks:
 *   - server is up (implicit — we responded)
 *   - Supabase reachable via a cheap count query
 */
export async function GET() {
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
