import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  status: z.enum(["pending", "live", "finished"]),
  winnerSide: z.enum(["a", "b"]).optional(),
});

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
    .select("team_a_id, team_b_id, started_at")
    .eq("id", matchId)
    .single();
  if (mErr) throw mErr;

  if (body.status === "finished" && body.winnerSide) {
    patch.winner_team_id =
      body.winnerSide === "a" ? match.team_a_id : match.team_b_id;
  } else if (body.status !== "finished") {
    patch.winner_team_id = null;
  }

  // Stamp the first time this match goes live (don't overwrite if reopened)
  if (body.status === "live" && !match.started_at) {
    patch.started_at = new Date().toISOString();
  }

  const { error } = await db.from("matches").update(patch).eq("id", matchId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
