import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildTeamsForStrategy,
  validatePlayersFor,
  type Player,
} from "@/lib/teamBalancer";
import type { MbtiTypeCode } from "@/lib/db/types";

const Body = z.object({ tournamentId: z.string().uuid() });

// Palette for team cards — 8 distinct hues so cards stay visually
// distinguishable while names are still the generic 「隊伍 N」 (admin renames
// them from the roster board after the fact).
const TEAM_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
];

export async function POST(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  const { tournamentId } = Body.parse(await req.json());
  const db = supabaseAdmin();

  const { data: tournament, error: tErr } = await db
    .from("tournaments")
    .select("id, grouping_strategy")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tErr) {
    // Expose real DB errors (e.g. "column grouping_strategy does not exist"
    // when the 0005 migration hasn't been applied yet) instead of masking
    // them as a generic 404.
    return NextResponse.json({ error: tErr.message }, { status: 400 });
  }
  if (!tournament) {
    return NextResponse.json({ error: "tournament not found" }, { status: 404 });
  }
  const strategy = tournament.grouping_strategy as
    | "zodiac_together"
    | "zodiac_mixed"
    | "mbti_together"
    | "mbti_mixed";

  const { data: regs, error: regErr } = await db
    .from("registrations")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (regErr) throw regErr;
  if (!regs || regs.length === 0) {
    return NextResponse.json({ error: "尚未有報名資料" }, { status: 400 });
  }

  const players: Player[] = regs.map((r) => ({
    id: r.id,
    name: r.name,
    // Fallback to epoch when birthday is missing — validation below catches
    // it for zodiac strategies. MBTI strategies don't rely on birthday.
    birthday: r.birthday ? new Date(r.birthday + "T12:00:00") : new Date(NaN),
    gender: (r.gender ?? undefined) as Player["gender"],
    position: (r.position ?? "any") as Player["position"],
    skill: r.skill_level ?? 3,
    mbti: (r.mbti ?? undefined) as MbtiTypeCode | undefined,
  }));

  if (players.length < 8) {
    return NextResponse.json(
      { error: `報名人數需 >= 8 (目前 ${players.length})` },
      { status: 400 },
    );
  }

  const validation = validatePlayersFor(strategy, players);
  if (!validation.ok) {
    if (validation.missingMbti) {
      const names = validation.missingMbti.map((p) => p.name).join("、");
      return NextResponse.json(
        {
          error: `以下報名者尚未填寫 MBTI,請先補齊再分隊:${names}`,
          missing: "mbti",
          count: validation.missingMbti.length,
        },
        { status: 400 },
      );
    }
    if (validation.missingBirthday) {
      const names = validation.missingBirthday.map((p) => p.name).join("、");
      return NextResponse.json(
        {
          error: `以下報名者尚未填寫生日,請先補齊再分隊:${names}`,
          missing: "birthday",
          count: validation.missingBirthday.length,
        },
        { status: 400 },
      );
    }
  }

  const result = buildTeamsForStrategy(strategy, players);

  // All strategies emit generic 「隊伍 1..N」 names + a rotating MIXED palette,
  // regardless of internal grouping (火象/水象 or NF/NT/…). Rationale: teams
  // are provisioned before match day and the schedule leaks team NAMES to
  // participants; a name like 「火象 A」 would tip off which players are on
  // it. Admins rename teams from the roster board after players pick their
  // own name on match day.
  interface TeamRow {
    name: string;
    element: null;
    temperament: null;
    color: string;
    members: Player[];
  }
  const teamRows: TeamRow[] = result.teams.map((t, i) => ({
    name: `隊伍 ${i + 1}`,
    element: null,
    temperament: null,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    members: t.members,
  }));

  // Wipe existing teams + matches for this tournament. Cascades drop members + sets.
  await db.from("matches").delete().eq("tournament_id", tournamentId);
  await db.from("teams").delete().eq("tournament_id", tournamentId);

  for (let i = 0; i < teamRows.length; i++) {
    const t = teamRows[i];
    const { data: inserted, error: teamErr } = await db
      .from("teams")
      .insert({
        tournament_id: tournamentId,
        name: t.name,
        element: t.element,
        temperament: t.temperament,
        color: t.color,
        seed: i + 1,
      })
      .select("id")
      .single();
    if (teamErr) throw teamErr;
    if (t.members.length > 0) {
      const memberRows = t.members.map((p) => ({
        team_id: inserted.id,
        registration_id: p.id,
      }));
      const { error: mErr } = await db.from("team_members").insert(memberRows);
      if (mErr) throw mErr;
    }
  }

  return NextResponse.json({ ok: true, teams: teamRows.length, strategy });
}
