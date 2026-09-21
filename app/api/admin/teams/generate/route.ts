import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findAdminByPin } from "@/lib/auth/pin";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";
import {
  buildTeamsForStrategy,
  validatePlayersFor,
  type Player,
} from "@/lib/teamBalancer";
import type { MbtiTypeCode } from "@/lib/db/types";

const Body = z.object({
  tournamentId: z.string().uuid(),
  // Required when regenerating over an existing team set (PIN re-check to
  // prevent fat-fingered wipes after publish). Optional on first generation.
  pin: z.string().min(4).max(32).optional(),
});

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
  // Wrap the whole handler so any thrown DB error / zod parse fault comes
  // back as a JSON response the client can actually read. Without this the
  // caller sees a truncated body and only reports "Unexpected end of JSON
  // input" — useless for diagnosing the real cause.
  try {
    return await handleGenerate(req);
  } catch (e) {
    // Supabase PostgrestError isn't an Error instance — it's a plain object
    // { message, details, hint, code }. String(e) on it yields "[object
    // Object]", which is what leaked to the toast the first time round.
    // Extract the relevant string bits from any of: real Error, Postgrest,
    // string, unknown.
    let message: string;
    let extra: Record<string, unknown> | null = null;
    if (e instanceof Error) {
      message = e.message;
    } else if (e && typeof e === "object") {
      const obj = e as Record<string, unknown>;
      message =
        typeof obj.message === "string" && obj.message.length > 0
          ? obj.message
          : JSON.stringify(obj);
      extra = {
        code: obj.code,
        hint: obj.hint,
        details: obj.details,
      };
    } else {
      message = String(e);
    }
    console.error("teams/generate failed", { message, extra, error: e });
    return NextResponse.json(
      { error: `分隊失敗:${message}`, ...(extra ? { extra } : {}) },
      { status: 500 },
    );
  }
}

async function handleGenerate(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  const body = Body.parse(await req.json());
  const { tournamentId } = body;
  const db = supabaseAdmin();

  // Regeneration guard: if teams already exist for this tournament, require
  // the logged-in admin's PIN. Same pattern as /api/admin/schedule/generate.
  // Prevents an accidental re-run from wiping team_members after publish.
  const { count: existingTeamCount } = await db
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if ((existingTeamCount ?? 0) > 0) {
    if (!body.pin) {
      return NextResponse.json(
        { error: "pin_required", message: "已有隊伍,請輸入 PIN 確認重新分隊" },
        { status: 401 },
      );
    }
    if (!(await tryRateLimit(`teams-regen:${clientIp(req)}`, 5, 60))) {
      return NextResponse.json(
        { error: "嘗試次數過多,請稍後再試" },
        { status: 429 },
      );
    }
    const admin = await findAdminByPin(body.pin);
    if (!admin || admin.id !== sess.adminId) {
      return NextResponse.json({ error: "PIN 不正確" }, { status: 401 });
    }
  }

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

  // Only admin-confirmed active players enter team generation. Waitlisted
  // rows (both forms in but payment unverified) never touch team_members —
  // they'd contaminate the balance and be visible on /teams post-publish.
  const { data: regs, error: regErr } = await db
    .from("registrations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("is_active", true);
  if (regErr) throw new Error(`fetch registrations: ${regErr.message}`);
  if (!regs || regs.length === 0) {
    return NextResponse.json(
      { error: "尚未有已確認的報名資料" },
      { status: 400 },
    );
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
      { error: `已確認球員需 >= 8 (目前 ${players.length})` },
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

  // Pre-insert invariant check. Cheap to run and turns any future balancer
  // regression into a specific, actionable error instead of a downstream
  // PK-violation mystery ("(team_id, registration_id) already exists").
  const seen = new Map<string, number>();
  let assigned = 0;
  for (let i = 0; i < result.teams.length; i++) {
    for (const p of result.teams[i].members) {
      assigned++;
      const prev = seen.get(p.id);
      if (prev !== undefined) {
        throw new Error(
          `balancer produced duplicate: player ${p.name} (${p.id}) appears in teams ${prev + 1} and ${i + 1}`,
        );
      }
      seen.set(p.id, i);
    }
  }
  if (assigned !== players.length) {
    throw new Error(
      `balancer lost players: ${players.length} in, ${assigned} out (${players.length - assigned} missing)`,
    );
  }

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
  const { error: delMatchesErr } = await db
    .from("matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (delMatchesErr) throw new Error(`delete matches: ${delMatchesErr.message}`);
  const { error: delTeamsErr } = await db
    .from("teams")
    .delete()
    .eq("tournament_id", tournamentId);
  if (delTeamsErr) throw new Error(`delete teams: ${delTeamsErr.message}`);

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
    if (teamErr)
      throw new Error(
        `insert team ${t.name} (seed ${i + 1}): ${teamErr.message}${teamErr.details ? " · " + teamErr.details : ""}`,
      );
    if (t.members.length > 0) {
      const memberRows = t.members.map((p) => ({
        team_id: inserted.id,
        registration_id: p.id,
      }));
      const { error: mErr } = await db.from("team_members").insert(memberRows);
      if (mErr)
        throw new Error(
          `insert team_members for ${t.name} (${memberRows.length} rows): ${mErr.message}${mErr.details ? " · " + mErr.details : ""}`,
        );
    }
  }

  return NextResponse.json({ ok: true, teams: teamRows.length, strategy });
}
