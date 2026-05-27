import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  side: z.enum(["a", "b"]).nullable(),
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
  const { side } = Body.parse(await req.json());
  const db = supabaseAdmin();

  if (side === null) {
    const { error } = await db
      .from("matches")
      .update({ serving_team_id: null })
      .eq("id", matchId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  }

  const { data: match, error: mErr } = await db
    .from("matches")
    .select("team_a_id, team_b_id")
    .eq("id", matchId)
    .single();
  if (mErr) throw mErr;
  const teamId = side === "a" ? match.team_a_id : match.team_b_id;
  const { error } = await db
    .from("matches")
    .update({ serving_team_id: teamId })
    .eq("id", matchId);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
