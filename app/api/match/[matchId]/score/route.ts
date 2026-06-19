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

  // Load current sets for this match
  const { data: existing, error: loadErr } = await db
    .from("match_sets")
    .select("*")
    .eq("match_id", matchId)
    .order("set_no", { ascending: true });
  if (loadErr) throw loadErr;
  const sets = existing ?? [];

  if (body.action === "bump") {
    const target = sets.find((s) => s.set_no === body.setNo);
    if (!target) {
      const fresh = {
        match_id: matchId,
        set_no: body.setNo,
        score_a: body.side === "a" ? Math.max(0, body.delta) : 0,
        score_b: body.side === "b" ? Math.max(0, body.delta) : 0,
      };
      const { error } = await db.from("match_sets").insert(fresh);
      if (error) throw error;
    } else {
      const next = {
        ...target,
        score_a:
          body.side === "a" ? Math.max(0, target.score_a + body.delta) : target.score_a,
        score_b:
          body.side === "b" ? Math.max(0, target.score_b + body.delta) : target.score_b,
      };
      const { error } = await db
        .from("match_sets")
        .update({ score_a: next.score_a, score_b: next.score_b })
        .eq("match_id", matchId)
        .eq("set_no", body.setNo);
      if (error) throw error;
    }
    // Rally-point scoring: whoever just scored gets the serve.
    // Only on +1 — −1 is a correction and shouldn't flip the serve.
    if (body.delta > 0) {
      const { data: m } = await db
        .from("matches")
        .select("team_a_id, team_b_id")
        .eq("id", matchId)
        .single();
      if (m) {
        const newServer = body.side === "a" ? m.team_a_id : m.team_b_id;
        await db
          .from("matches")
          .update({ serving_team_id: newServer })
          .eq("id", matchId);
      }
    }
  } else if (body.action === "set") {
    const { error } = await db
      .from("match_sets")
      .upsert({
        match_id: matchId,
        set_no: body.setNo,
        score_a: body.scoreA,
        score_b: body.scoreB,
      });
    if (error) throw error;
  }

  // Audit
  await db.from("score_edits").insert({
    match_id: matchId,
    admin_id: sess.adminId,
    set_no: "setNo" in body ? body.setNo : null,
    before: sets,
    after: body,
  });

  // Return refreshed sets
  const { data: refreshed } = await db
    .from("match_sets")
    .select("*")
    .eq("match_id", matchId)
    .order("set_no", { ascending: true });
  return NextResponse.json({ sets: refreshed ?? [] });
}
