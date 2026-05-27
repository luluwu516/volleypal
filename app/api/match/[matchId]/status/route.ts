import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { advanceBracketAfterFinish } from "@/lib/autoFillKnockout";

const Body = z.object({
  status: z.enum(["pending", "live", "finished"]),
  winnerSide: z.enum(["a", "b"]).optional(),
});

const KNOCKOUT_PHASES = [
  "semifinal",
  "silver_semifinal",
  "final",
  "third_place",
  "silver_final",
  "silver_third_place",
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { matchId } = await params;
  const body = Body.parse(await req.json());
  const db = supabaseAdmin();

  const patch: Record<string, unknown> = { status: body.status };

  const { data: match, error: mErr } = await db
    .from("matches")
    .select("team_a_id, team_b_id, started_at, phase, tournament_id, scheduled_at, court")
    .eq("id", matchId)
    .single();
  if (mErr) throw mErr;

  let loserTeamId: string | null = null;
  if (body.status === "finished" && body.winnerSide) {
    const winnerId =
      body.winnerSide === "a" ? match.team_a_id : match.team_b_id;
    loserTeamId =
      body.winnerSide === "a" ? match.team_b_id : match.team_a_id;
    patch.winner_team_id = winnerId;
  } else if (body.status !== "finished") {
    patch.winner_team_id = null;
  }

  if (body.status === "live" && !match.started_at) {
    patch.started_at = new Date().toISOString();
  }

  const { error } = await db.from("matches").update(patch).eq("id", matchId);
  if (error) throw error;

  // Advance the bracket: fill semifinals from group standings, then
  // finals/3rd-place from semis once they finish. Best-effort, logs on error.
  if (body.status === "finished") {
    await advanceBracketAfterFinish(db, match.tournament_id, match.phase);
  }

  // Knockout referee chain: when a knockout match finishes, the loser
  // becomes the referee of the next pending knockout match in the same
  // tournament (ordered by scheduled_at, then court). Only sets if the
  // next match doesn't already have a referee — admin overrides win.
  if (
    body.status === "finished" &&
    loserTeamId &&
    KNOCKOUT_PHASES.includes(match.phase)
  ) {
    const { data: nextCandidates } = await db
      .from("matches")
      .select("id, scheduled_at, court, referee_team_id, status")
      .eq("tournament_id", match.tournament_id)
      .in("phase", KNOCKOUT_PHASES)
      .neq("status", "finished")
      .order("scheduled_at", { ascending: true })
      .order("court", { ascending: true });

    const next = (nextCandidates ?? []).find((m) => {
      if (m.id === matchId) return false;
      if (m.referee_team_id) return false;
      // strictly after this match in (scheduled_at, court) order
      if (!m.scheduled_at || !match.scheduled_at) return true;
      if (m.scheduled_at > match.scheduled_at) return true;
      if (
        m.scheduled_at === match.scheduled_at &&
        (m.court ?? 0) > (match.court ?? 0)
      )
        return true;
      return false;
    });

    if (next) {
      await db
        .from("matches")
        .update({ referee_team_id: loserTeamId })
        .eq("id", next.id);
    }
  }

  return NextResponse.json({ ok: true });
}
