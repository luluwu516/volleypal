import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({ targetTeamId: z.string().uuid() });

// Move one player to a different team. Strategy-agnostic — this just flips
// team_members.team_id and doesn't care whether teams were seeded by zodiac,
// MBTI, or something else. Manual balance tweak after auto-generation.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }

  const { registrationId } = await params;
  const { targetTeamId } = Body.parse(await req.json());

  const db = supabaseAdmin();

  // Verify the target team belongs to the same tournament as the current one
  // so a stray call can't move a player across tournaments.
  const [currentRow, targetRow] = await Promise.all([
    db
      .from("team_members")
      .select("team_id, teams!inner(tournament_id)")
      .eq("registration_id", registrationId)
      .maybeSingle(),
    db
      .from("teams")
      .select("id, tournament_id")
      .eq("id", targetTeamId)
      .maybeSingle(),
  ]);

  if (!currentRow.data) {
    return NextResponse.json({ error: "member not found" }, { status: 404 });
  }
  if (!targetRow.data) {
    return NextResponse.json({ error: "target team not found" }, { status: 404 });
  }

  const currentTournament = (
    currentRow.data.teams as unknown as { tournament_id: string }
  ).tournament_id;
  if (currentTournament !== targetRow.data.tournament_id) {
    return NextResponse.json(
      { error: "cross-tournament move rejected" },
      { status: 400 },
    );
  }

  if (currentRow.data.team_id === targetTeamId) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const { error } = await db
    .from("team_members")
    .update({ team_id: targetTeamId })
    .eq("registration_id", registrationId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
