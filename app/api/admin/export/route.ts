import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

// Dump every table for the current tournament as one JSON blob. Handy for
// end-of-event archival (Supabase free tier retention isn't forever) or
// offline analysis. Admin-only; served inline so the browser saves it via
// Content-Disposition.
//
// Contains the full raw_form_payload (all PII from the Google Form) so
// backups are complete enough to spin up a fresh Supabase during an event.
// Blocked in locked (referee) mode — a phone handed to a scorer should not
// be able to walk off with a copy of the roster.
export async function GET(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  if (!(await tryRateLimit(`export:${sess.adminId}:${clientIp(req)}`, 10, 60))) {
    return NextResponse.json(
      { error: "匯出過於頻繁,請稍後再試" },
      { status: 429 },
    );
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
    pendingWaivers,
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
    // Orphan waivers are in the backup because they're the ONLY record the app
    // holds of a signature that hasn't been credited to anyone yet, and the
    // admin UI can delete one with a single tap. One got mis-tapped away on a
    // phone and nothing could recover it — the player simply vanished from
    // the system. Cheap row, un-reconstructable content.
    db.from("pending_waivers").select("*").eq("tournament_id", tid),
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
    pending_waivers: pendingWaivers.data ?? [],
  };

  // Date, not tournament.year: every backup taken during a tournament would
  // otherwise land on the same name and overwrite the previous one in the
  // browser's download folder, which defeats the point of taking one before a
  // risky change. Rendered in the event's timezone so the filename matches the
  // day the admin actually pressed the button.
  const day = formatInTimeZone(new Date(), TZ, "yyyyMMdd");
  const filename = `volleypal-${day}-${tid.slice(0, 8)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
