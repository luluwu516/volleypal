import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("bump"),
    side: z.enum(["a", "b"]),
    delta: z.number().int().min(-3).max(3),
    setNo: z.number().int().min(1).max(3),
  }),
  z.object({
    action: z.literal("set"),
    setNo: z.number().int().min(1).max(3),
    scoreA: z.number().int().min(0).max(99),
    scoreB: z.number().int().min(0).max(99),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { matchId } = await params;
  if (sess.locked && sess.lockedMatchId && sess.lockedMatchId !== matchId) {
    return NextResponse.json(
      { error: "locked to another match" },
      { status: 403 },
    );
  }
  const body = Body.parse(await req.json());
  const db = supabaseAdmin();

  // Snapshot state before the change for the audit log. Best-effort — if it
  // fails we still apply the score change.
  const { data: before } = await db
    .from("match_sets")
    .select("*")
    .eq("match_id", matchId)
    .order("set_no", { ascending: true });

  if (body.action === "bump") {
    // Atomic increment via Postgres RPC — no SELECT-then-UPDATE race.
    // See supabase/migrations/0004_atomic_bump_score.sql.
    const { error } = await db.rpc("bump_match_score", {
      p_match_id: matchId,
      p_set_no: body.setNo,
      p_side: body.side,
      p_delta: body.delta,
    });
    if (error) throw error;
  } else {
    // Absolute set — last-write-wins is acceptable for a corrective admin op.
    const { error } = await db.from("match_sets").upsert({
      match_id: matchId,
      set_no: body.setNo,
      score_a: body.scoreA,
      score_b: body.scoreB,
    });
    if (error) throw error;
  }

  await db.from("score_edits").insert({
    match_id: matchId,
    admin_id: sess.adminId,
    set_no: body.setNo,
    before: before ?? [],
    after: body,
  });

  const { data: refreshed } = await db
    .from("match_sets")
    .select("*")
    .eq("match_id", matchId)
    .order("set_no", { ascending: true });
  return NextResponse.json({ sets: refreshed ?? [] });
}
