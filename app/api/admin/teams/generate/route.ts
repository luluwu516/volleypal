import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildTeamsForStrategy,
  validatePlayersFor,
  type Player,
} from "@/lib/teamBalancer";
import { ELEMENT_LABELS_ZH } from "@/lib/zodiac";
import { TEMPERAMENT_LABELS_ZH } from "@/lib/mbti";
import type { MbtiTypeCode } from "@/lib/db/types";

const Body = z.object({ tournamentId: z.string().uuid() });

const ELEMENT_COLORS = {
  fire: "#ef4444",
  earth: "#a16207",
  air: "#a78bfa",
  water: "#06b6d4",
} as const;

const TEMPERAMENT_COLORS = {
  NF: "#a855f7", // purple
  NT: "#38bdf8", // sky
  SJ: "#22c55e", // green
  SP: "#f59e0b", // amber
} as const;

// Palette for mixed-strategy teams — 8 distinct hues so team cards remain
// visually distinguishable when there's no attribute anchor.
const MIXED_COLORS = [
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

  // Flatten to a common shape (name, element?, temperament?, color, members[])
  interface TeamRow {
    name: string;
    element: keyof typeof ELEMENT_COLORS | null;
    temperament: keyof typeof TEMPERAMENT_COLORS | null;
    color: string;
    members: Player[];
  }
  let teamRows: TeamRow[];
  if (result.kind === "together_zodiac") {
    teamRows = result.teams.map((t) => ({
      name: `${ELEMENT_LABELS_ZH[t.attribute]} ${t.subLabel}`,
      element: t.attribute,
      temperament: null,
      color: ELEMENT_COLORS[t.attribute],
      members: t.members,
    }));
  } else if (result.kind === "together_mbti") {
    teamRows = result.teams.map((t) => ({
      name: `${TEMPERAMENT_LABELS_ZH[t.attribute]} ${t.subLabel}`,
      element: null,
      temperament: t.attribute,
      color: TEMPERAMENT_COLORS[t.attribute],
      members: t.members,
    }));
  } else {
    teamRows = result.teams.map((t, i) => ({
      name: t.name,
      element: null,
      temperament: null,
      color: MIXED_COLORS[i % MIXED_COLORS.length],
      members: t.members,
    }));
  }

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
