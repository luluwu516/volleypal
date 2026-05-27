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

  // Snake-draft seeds into groups so that:
  //   - same-element sub-teams (e.g. 土象 A / 土象 B) end up in different groups,
  //   - the two groups don't play symmetric mirror matchups
  //     (avoids the "土象A vs 水象A" + "土象B vs 水象B" pattern in parallel courts).
  // Seeds 1-8 -> A B B A A B B A
  const groupA: SchedulerTeam[] = [];
  const groupB: SchedulerTeam[] = [];
  const SNAKE = ["A", "B", "B", "A", "A", "B", "B", "A"] as const;
  teams.forEach((t, i) => {
    const label = SNAKE[i] ?? (i % 2 === 0 ? "A" : "B");
    (label === "A" ? groupA : groupB).push({ id: t.id, groupLabel: label });
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
      referee_team_id: m.refereeTeamId ?? null,
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
      // Knockout refs assigned dynamically: previous match's loser refs the
      // next pending knockout match. See /api/match/[id]/status.
      referee_team_id: null,
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
