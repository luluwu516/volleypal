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
    console.error("/api/announcements failed", e);
    return NextResponse.json({ announcements: [] }, { status: 200 });
  }
}
