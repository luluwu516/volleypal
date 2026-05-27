import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildEightTeams, type Player } from "@/lib/teamBalancer";
import { ELEMENT_LABELS_ZH } from "@/lib/zodiac";

const Body = z.object({ tournamentId: z.string().uuid() });

const ELEMENT_COLORS = {
  fire: "#ef4444",
  earth: "#a16207",
  air: "#60a5fa",
  water: "#06b6d4",
} as const;

export async function POST(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { tournamentId } = Body.parse(await req.json());
  const db = supabaseAdmin();

  const { data: regs, error: regErr } = await db
    .from("registrations")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (regErr) throw regErr;
  if (!regs || regs.length === 0) {
    return NextResponse.json({ error: "尚未有報名資料" }, { status: 400 });
  }

  const players: Player[] = regs
    .filter((r) => r.birthday)
    .map((r) => ({
      id: r.id,
      name: r.name,
      birthday: new Date(r.birthday + "T12:00:00"),
      gender: (r.gender ?? undefined) as Player["gender"],
      position: (r.position ?? "any") as Player["position"],
      skill: r.skill_level ?? 3,
    }));

  if (players.length < 8) {
    return NextResponse.json(
      { error: `報名人數需 >= 8 (目前 ${players.length})` },
      { status: 400 },
    );
  }

  const subTeams = buildEightTeams(players);

  // Wipe existing teams + matches for this tournament. Cascades drop members + sets.
  await db.from("matches").delete().eq("tournament_id", tournamentId);
  await db.from("teams").delete().eq("tournament_id", tournamentId);

  for (let i = 0; i < subTeams.length; i++) {
    const t = subTeams[i];
    const { data: inserted, error: teamErr } = await db
      .from("teams")
      .insert({
        tournament_id: tournamentId,
        name: `${ELEMENT_LABELS_ZH[t.element]} ${t.subLabel}`,
        element: t.element,
        color: ELEMENT_COLORS[t.element],
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

  return NextResponse.json({ ok: true, teams: subTeams.length });
}
