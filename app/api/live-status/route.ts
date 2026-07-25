import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentTournament } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

// Slim status endpoint for the BottomNav "live" indicator. Polling
// /api/scores just to check a boolean is wasteful — this returns only the
// count of live matches for the current tournament.
export async function GET() {
  try {
    const tournament = await getCurrentTournament();
    if (!tournament) {
      return NextResponse.json({ hasLive: false, count: 0 });
    }
    const { count } = await supabaseAdmin()
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id)
      .eq("status", "live");
    const n = count ?? 0;
    return NextResponse.json({ hasLive: n > 0, count: n });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
