import { NextResponse } from "next/server";
import {
  getCurrentTournament,
  listMatches,
  listMatchSets,
  listTeams,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tournament = await getCurrentTournament();
    if (!tournament) {
      return NextResponse.json({ tournament: null, matches: [], teams: [], sets: [] });
    }
    const [teams, matches] = await Promise.all([
      listTeams(tournament.id),
      listMatches(tournament.id),
    ]);
    const liveOrPending = matches.filter(
      (m) => m.status === "live" || m.status === "pending",
    );
    const sets = await listMatchSets(liveOrPending.map((m) => m.id));
    return NextResponse.json({
      tournament,
      teams,
      matches: liveOrPending,
      sets,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
