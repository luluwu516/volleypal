import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildFullSchedule, type SchedulerTeam } from "@/lib/scheduler";

const Body = z.object({
  tournamentId: z.string().uuid(),
  numCourts: z.number().int().min(1).max(8),
  matchDurationMin: z.number().int().min(10).max(180),
  startsAt: z.string(),
});

export async function POST(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = Body.parse(await req.json());
  const db = supabaseAdmin();

  const { data: teams, error: tErr } = await db
    .from("teams")
    .select("id, seed")
    .eq("tournament_id", body.tournamentId)
    .order("seed", { ascending: true, nullsFirst: false });
  if (tErr) throw tErr;
  if (!teams || teams.length !== 8) {
    return NextResponse.json(
      { error: `需要 8 隊 (目前 ${teams?.length ?? 0})` },
      { status: 400 },
    );
  }

  // Assign first 4 (by seed) to group A, next 4 to group B. Snake-ish: 1,4,5,8 vs 2,3,6,7
  // For zodiac mode this groups 火A/火B/土A/土B vs 風A/風B/水A/水B - rough but acceptable
  // and admin can manually adjust the team rows' group assignment later if needed.
  const groupA: SchedulerTeam[] = [];
  const groupB: SchedulerTeam[] = [];
  teams.forEach((t, i) => {
    const arr = i % 2 === 0 ? groupA : groupB;
    arr.push({ id: t.id, groupLabel: arr === groupA ? "A" : "B" });
  });

  const schedule = buildFullSchedule({
    teams: [...groupA, ...groupB],
    numCourts: body.numCourts,
    matchDurationMin: body.matchDurationMin,
    startsAt: new Date(body.startsAt),
  });

  // Clear pending matches; preserve finished
  await db
    .from("matches")
    .delete()
    .eq("tournament_id", body.tournamentId)
    .neq("status", "finished");

  const rows = [
    ...schedule.groupMatches.map((m) => ({
      tournament_id: body.tournamentId,
      phase: m.phase,
      group_label: m.groupLabel,
      court: m.court,
      scheduled_at: m.scheduledAt.toISOString(),
      team_a_id: m.teamAId,
      team_b_id: m.teamBId,
      team_a_source: m.teamASource ?? null,
      team_b_source: m.teamBSource ?? null,
      status: "pending",
    })),
    ...schedule.knockoutMatches.map((m) => ({
      tournament_id: body.tournamentId,
      phase: m.phase,
      group_label: null,
      court: m.court,
      scheduled_at: m.scheduledAt.toISOString(),
      team_a_id: m.teamAId,
      team_b_id: m.teamBId,
      team_a_source: m.teamASource ?? null,
      team_b_source: m.teamBSource ?? null,
      status: "pending",
    })),
  ];
  const { error: insErr } = await db.from("matches").insert(rows);
  if (insErr) throw insErr;

  // Also persist the chosen settings on the tournament
  await db
    .from("tournaments")
    .update({
      num_courts: body.numCourts,
      match_duration_min: body.matchDurationMin,
    })
    .eq("id", body.tournamentId);

  return NextResponse.json({ ok: true, matches: rows.length });
}
