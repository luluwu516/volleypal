import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

// Dump every table for the current tournament as one JSON blob. Handy for
// end-of-event archival (Supabase free tier retention isn't forever) or
// offline analysis. Admin-only; served inline so the browser saves it via
// Content-Disposition.
export async function GET() {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: tournament } = await db
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return NextResponse.json({ error: "no tournament" }, { status: 404 });
  }

  const tid = tournament.id;
  const [
    teams,
    teamMembers,
    matches,
    matchSets,
    registrations,
    announcements,
  ] = await Promise.all([
    db.from("teams").select("*").eq("tournament_id", tid),
    // team_members has no tournament_id; join through teams via .in()
    db.from("teams").select("id").eq("tournament_id", tid).then(async (r) => {
      const ids = (r.data ?? []).map((t: { id: string }) => t.id);
      if (ids.length === 0) return { data: [], error: null };
      return db.from("team_members").select("*").in("team_id", ids);
    }),
    db.from("matches").select("*").eq("tournament_id", tid),
    db.from("matches").select("id").eq("tournament_id", tid).then(async (r) => {
      const ids = (r.data ?? []).map((m: { id: string }) => m.id);
      if (ids.length === 0) return { data: [], error: null };
      return db.from("match_sets").select("*").in("match_id", ids);
    }),
    db.from("registrations").select("*").eq("tournament_id", tid),
    db.from("announcements").select("*").eq("tournament_id", tid),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    exported_by: sess.adminName,
    tournament,
    teams: teams.data ?? [],
    team_members: teamMembers.data ?? [],
    matches: matches.data ?? [],
    match_sets: matchSets.data ?? [],
    registrations: registrations.data ?? [],
    announcements: announcements.data ?? [],
  };

  const filename = `volleypal-${tournament.year}-${tid.slice(0, 8)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
