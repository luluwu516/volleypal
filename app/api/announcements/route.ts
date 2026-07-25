import { NextResponse } from "next/server";
import { getCurrentTournament, listAnnouncements } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tournament = await getCurrentTournament();
    if (!tournament) {
      return NextResponse.json({ announcements: [] });
    }
    const announcements = await listAnnouncements(tournament.id);
    return NextResponse.json({ announcements });
  } catch (e) {
    // Real error → surface it. Client provider keeps its last-good state
    // and shows a stale banner instead of silently blanking the drawer,
    // which used to hide a Supabase outage as "no broadcasts".
    console.error("/api/announcements failed", e);
    return NextResponse.json(
      { error: "failed to load" },
      { status: 500 },
    );
  }
}
