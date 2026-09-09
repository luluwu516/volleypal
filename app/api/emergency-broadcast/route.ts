import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";
import {
  composeBody,
  isValidLocationKey,
  EQUIPMENT_ITEM_KEYS,
  INJURY_ITEM_KEYS,
} from "@/lib/emergency-broadcast/templates";

/**
 * Player-side emergency broadcast. Public endpoint, no auth: any viewer of
 * the app can send. Guarded by three layers so the channel stays useful in
 * a real emergency without becoming a spam vector:
 *
 *   1. Client-side cooldown (localStorage, 10 min) — advisory. Best-effort
 *      because a private-browsing session can bypass it.
 *   2. Server per-IP throttle — 10 min, max 2. Authoritative.
 *   3. Global per-tournament ceiling — 30 min, max 3 player broadcasts. If
 *      breached, we DOWNGRADE the level from `urgent` (blocking modal) to
 *      `info` (dismissible banner) instead of blocking outright. The 4th
 *      broadcast still reaches everyone; it just won't fight for attention
 *      against noise from the first three. This preserves the promise "the
 *      first emergency always gets through as urgent" while capping the
 *      urgent-modal frequency.
 *
 * Kill switch (`tournaments.allow_player_broadcast`) blocks ALL sends when
 * off but leaves already-published broadcasts alone. Turning it off in the
 * middle of an incident does not retroactively silence.
 *
 * The composed body always carries the `🆘 球員廣播:` prefix so the display
 * layer (banner, modal, admin history) can distinguish player-authored
 * announcements even when only reading `body`.
 */

// Free-text fields need a sane cap and stripped control chars — anonymous
// text can carry newlines / paste noise that would break the banner layout.
const FREE_TEXT = z
  .string()
  .max(40)
  .transform((s) => s.replace(/[\r\n\t]+/g, " ").trim())
  .optional()
  .nullable();

const Body = z.object({
  tournament_id: z.string().uuid(),
  issue: z.enum(["equipment", "injury"]),
  location_key: z.string().max(32),
  location_other: FREE_TEXT,
  item_keys: z.array(z.string().max(32)).max(8),
  item_other: FREE_TEXT,
});

const URGENT_EXPIRES_MIN = 45;
const GLOBAL_CAP = 3;
const GLOBAL_WINDOW_MIN = 30;

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid body" },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();

  // Kill switch + num_courts check in a single query.
  const { data: tournament, error: tErr } = await db
    .from("tournaments")
    .select("id, num_courts, allow_player_broadcast")
    .eq("id", parsed.tournament_id)
    .maybeSingle();
  if (tErr || !tournament) {
    return NextResponse.json({ error: "tournament not found" }, { status: 404 });
  }
  if (!tournament.allow_player_broadcast) {
    return NextResponse.json(
      { error: "廣播暫停中,請直接聯絡主辦或撥打 911" },
      { status: 403 },
    );
  }

  // Location validation depends on tournament.num_courts (dynamic upper
  // bound for court_N). Bad key OR missing other-text for "其他" both fail
  // here.
  if (!isValidLocationKey(parsed.location_key, tournament.num_courts)) {
    return NextResponse.json({ error: "invalid location" }, { status: 400 });
  }
  if (parsed.location_key === "other" && !parsed.location_other) {
    return NextResponse.json(
      { error: "選『其他』時請填地點" },
      { status: 400 },
    );
  }

  // Item keys must belong to the issue's allowed set — otherwise a client
  // could ferry equipment items into an injury broadcast and confuse the
  // rendered body.
  const allowed =
    parsed.issue === "equipment"
      ? new Set(EQUIPMENT_ITEM_KEYS)
      : new Set(INJURY_ITEM_KEYS);
  for (const k of parsed.item_keys) {
    if (!allowed.has(k)) {
      return NextResponse.json({ error: "invalid item" }, { status: 400 });
    }
  }
  if (parsed.item_keys.includes("other") && !parsed.item_other) {
    return NextResponse.json(
      { error: "選『其他』時請填需要的物品" },
      { status: 400 },
    );
  }

  // Per-IP limiter — keyed on the broadcast namespace so it doesn't share
  // buckets with other endpoints hitting tryRateLimit.
  const ip = clientIp(req);
  const ok = await tryRateLimit(
    `emergency-broadcast:${parsed.tournament_id}:${ip}`,
    2,
    600,
  );
  if (!ok) {
    return NextResponse.json(
      { error: "廣播冷卻中,若情況危急請直接呼叫主辦或撥打 911" },
      { status: 429 },
    );
  }

  // Global-ceiling check. Count player broadcasts in the last 30 minutes for
  // THIS tournament. Above the cap → downgrade level rather than block.
  const cutoff = new Date(Date.now() - GLOBAL_WINDOW_MIN * 60_000).toISOString();
  const { count: recentCount } = await db
    .from("announcements")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", parsed.tournament_id)
    .eq("source", "player")
    .gt("created_at", cutoff);
  const overCap = (recentCount ?? 0) >= GLOBAL_CAP;
  const level: "urgent" | "info" = overCap ? "info" : "urgent";

  const body = composeBody({
    issue: parsed.issue,
    location_key: parsed.location_key,
    location_other: parsed.location_other,
    item_keys: parsed.item_keys,
    item_other: parsed.item_other,
  });

  const expiresAt = new Date(
    Date.now() + URGENT_EXPIRES_MIN * 60_000,
  ).toISOString();

  const { data: inserted, error: insErr } = await db
    .from("announcements")
    .insert({
      tournament_id: parsed.tournament_id,
      body,
      level,
      source: "player",
      expires_at: expiresAt,
    })
    .select("id")
    .maybeSingle();
  if (insErr) {
    return NextResponse.json(
      { error: insErr.message, code: insErr.code },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    level,
    // Client uses this to gray the button until at least the per-IP
    // window has passed. Not authoritative — server still re-checks.
    cooldown_until: new Date(Date.now() + 600 * 1000).toISOString(),
    downgraded: overCap,
  });
}
