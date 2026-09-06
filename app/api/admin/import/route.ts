import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findAdminByPin } from "@/lib/auth/pin";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

// Backup restore: takes a JSON payload matching /api/admin/export's output
// and replaces the CURRENT tournament wholesale.
//
// Flow: snapshot the existing tournament into import_backups → hand the
// payload to the `import_tournament_payload` RPC which wipes and re-inserts
// every table in a single Postgres transaction. If any row fails (bad enum,
// orphan FK), Postgres rolls back the whole thing and the snapshot is still
// on tape.
//
// PIN-gated (same admin) + rate-limited because this is the most
// destructive operation in the app.

const Body = z.object({
  pin: z.string().min(4).max(32),
  payload: z.object({
    tournament: z.record(z.string(), z.unknown()),
    teams: z.array(z.record(z.string(), z.unknown())).default([]),
    team_members: z.array(z.record(z.string(), z.unknown())).default([]),
    matches: z.array(z.record(z.string(), z.unknown())).default([]),
    match_sets: z.array(z.record(z.string(), z.unknown())).default([]),
    registrations: z.array(z.record(z.string(), z.unknown())).default([]),
    announcements: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});

export async function POST(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  if (!(await tryRateLimit(`import:${clientIp(req)}`, 5, 60))) {
    return NextResponse.json(
      { error: "嘗試次數過多,請稍後再試" },
      { status: 429 },
    );
  }

  const body = Body.parse(await req.json());
  const admin = await findAdminByPin(body.pin);
  if (!admin || admin.id !== sess.adminId) {
    return NextResponse.json({ error: "PIN 不正確" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const tournament = body.payload.tournament as { id?: string };
  if (!tournament.id) {
    return NextResponse.json(
      { error: "payload 缺少 tournament.id" },
      { status: 400 },
    );
  }

  // Auto-snapshot before we touch anything. A bad payload (short field, wrong
  // enum) can bail mid-insert leaving the tournament in a mangled state — this
  // row is the "put back what was there" tape. Manual recovery: query
  // import_backups by created_at, re-POST the payload column to /api/admin/import.
  const { data: existingTournaments } = await db
    .from("tournaments")
    .select("id, name")
    .order("created_at", { ascending: false });
  const anyExisting = (existingTournaments ?? []).length > 0;
  if (anyExisting) {
    // Build the same shape /api/admin/export produces so the backup can be
    // fed straight back through /api/admin/import.
    const tid = existingTournaments![0].id;
    const [tRow, teamsRes, membersRes, matchesRes, setsRes, regsRes, annRes] =
      await Promise.all([
        db.from("tournaments").select("*").eq("id", tid).maybeSingle(),
        db.from("teams").select("*").eq("tournament_id", tid),
        db
          .from("teams")
          .select("id")
          .eq("tournament_id", tid)
          .then(async (r) => {
            const ids = (r.data ?? []).map((t: { id: string }) => t.id);
            if (ids.length === 0) return { data: [] as unknown[] };
            return db.from("team_members").select("*").in("team_id", ids);
          }),
        db.from("matches").select("*").eq("tournament_id", tid),
        db
          .from("matches")
          .select("id")
          .eq("tournament_id", tid)
          .then(async (r) => {
            const ids = (r.data ?? []).map((m: { id: string }) => m.id);
            if (ids.length === 0) return { data: [] as unknown[] };
            return db.from("match_sets").select("*").in("match_id", ids);
          }),
        db.from("registrations").select("*").eq("tournament_id", tid),
        db.from("announcements").select("*").eq("tournament_id", tid),
      ]);
    const snapshot = {
      snapshotted_at: new Date().toISOString(),
      tournament: tRow.data,
      teams: teamsRes.data ?? [],
      team_members: membersRes.data ?? [],
      matches: matchesRes.data ?? [],
      match_sets: setsRes.data ?? [],
      registrations: regsRes.data ?? [],
      announcements: annRes.data ?? [],
    };
    const { error: backupErr } = await db.from("import_backups").insert({
      created_by: sess.adminId,
      reason: `before import of ${tournament.id}`,
      payload: snapshot,
    });
    if (backupErr) {
      return NextResponse.json(
        {
          error: `無法建立備份,已中止匯入:${backupErr.message}`,
          stage: "snapshot",
        },
        { status: 500 },
      );
    }
  }

  // Single-shot transactional import. On any failure inside the RPC (bad
  // enum, orphan FK, missing required column), Postgres rolls back the wipe
  // + partial inserts so the old tournament is only gone if the new one
  // fully lands.
  const { data: result, error: rpcErr } = await db.rpc(
    "import_tournament_payload",
    { payload: body.payload },
  );
  if (rpcErr) {
    return NextResponse.json(
      {
        error: `匯入失敗,已保留原資料:${rpcErr.message}`,
        stage: "rpc",
        code: rpcErr.code,
        details: rpcErr.details,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    tournament_id: tournament.id,
    ...(result as Record<string, unknown>),
  });
}
