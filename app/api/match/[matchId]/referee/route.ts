import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  refereeTeamId: z.string().uuid().nullable(),
});

// Assign / clear the referee team for a single match. Admin-only, blocked in
// locked (referee-scorer) mode. Enforced constraints:
//   - target team belongs to the same tournament as the match
//   - target team is NOT one of the two teams playing this match (a team
//     can't referee itself)
//   - target team is NOT playing another match in the same time slot
//     (physical impossibility — same people can't be in two courts at once)
// The "same team refs two matches in one slot" case is allowed intentionally:
// if there aren't enough idle teams (8 teams / 3 courts leaves only 2 rest),
// the resting team splits into two ref groups.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }

  const { matchId } = await params;
  const { refereeTeamId } = Body.parse(await req.json());

  const db = supabaseAdmin();

  const { data: match, error: matchErr } = await db
    .from("matches")
    .select("id, tournament_id, team_a_id, team_b_id, scheduled_at")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr || !match) {
    return NextResponse.json({ error: "match not found" }, { status: 404 });
  }

  if (refereeTeamId !== null) {
    if (refereeTeamId === match.team_a_id || refereeTeamId === match.team_b_id) {
      return NextResponse.json(
        { error: "referee cannot be one of the playing teams" },
        { status: 400 },
      );
    }

    const { data: team } = await db
      .from("teams")
      .select("id, tournament_id")
      .eq("id", refereeTeamId)
      .maybeSingle();
    if (!team || team.tournament_id !== match.tournament_id) {
      return NextResponse.json(
        { error: "team not in this tournament" },
        { status: 400 },
      );
    }

    if (match.scheduled_at) {
      const { data: slotMates } = await db
        .from("matches")
        .select("id, team_a_id, team_b_id")
        .eq("tournament_id", match.tournament_id)
        .eq("scheduled_at", match.scheduled_at)
        .neq("id", match.id);
      const playingThisSlot = new Set<string>();
      for (const m of slotMates ?? []) {
        if (m.team_a_id) playingThisSlot.add(m.team_a_id);
        if (m.team_b_id) playingThisSlot.add(m.team_b_id);
      }
      if (playingThisSlot.has(refereeTeamId)) {
        return NextResponse.json(
          { error: "team is playing in another court this slot" },
          { status: 400 },
        );
      }
    }
  }

  const { error } = await db
    .from("matches")
    .update({ referee_team_id: refereeTeamId })
    .eq("id", matchId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
