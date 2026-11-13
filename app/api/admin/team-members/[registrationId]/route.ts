import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({ targetTeamId: z.string().uuid() });

// Set which team a player is on. Strategy-agnostic — this just writes
// team_members.team_id and doesn't care whether teams were seeded by zodiac,
// MBTI, or something else.
//
// Covers both halves of match-day roster churn: moving someone between teams
// (manual balance tweak after auto-generation) and seating someone who is on
// no team at all. The second case is the replacement path — 退回候補 drops a
// withdrawing player's team_members row to open the seat, and the admin then
// confirms a waitlisted player who arrives with no seat of their own. So a
// missing team_members row is a normal starting state here, not an error.
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

  const [regRow, targetRow, currentRow] = await Promise.all([
    db
      .from("registrations")
      .select("id, tournament_id, is_active")
      .eq("id", registrationId)
      .maybeSingle(),
    db
      .from("teams")
      .select("id, tournament_id")
      .eq("id", targetTeamId)
      .maybeSingle(),
    db
      .from("team_members")
      .select("team_id")
      .eq("registration_id", registrationId)
      .maybeSingle(),
  ]);

  if (!regRow.data) {
    return NextResponse.json({ error: "registration not found" }, { status: 404 });
  }
  if (!targetRow.data) {
    return NextResponse.json({ error: "target team not found" }, { status: 404 });
  }
  // Tournament comes off the registration rather than the current team, so
  // the check still holds for a player who isn't seated anywhere yet.
  if (regRow.data.tournament_id !== targetRow.data.tournament_id) {
    return NextResponse.json(
      { error: "cross-tournament move rejected" },
      { status: 400 },
    );
  }
  // A waitlisted player has no business on a team: 退回候補 clears the seat on
  // the way out, so letting one back in here would leave a roster count that
  // disagrees with the board.
  if (!regRow.data.is_active) {
    return NextResponse.json(
      { error: "尚未確認進球員列表,無法分隊" },
      { status: 400 },
    );
  }

  if (currentRow.data?.team_id === targetTeamId) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const { error } = currentRow.data
    ? await db
        .from("team_members")
        .update({ team_id: targetTeamId })
        .eq("registration_id", registrationId)
    : await db
        .from("team_members")
        .insert({ team_id: targetTeamId, registration_id: registrationId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, seated: !currentRow.data });
}
