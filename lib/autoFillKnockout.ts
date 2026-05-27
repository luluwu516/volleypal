/**
 * After a match transitions to "finished", advance the knockout bracket:
 *
 *   group match -> when ALL group matches are finished, fill both groups'
 *                  Gold & Silver semifinal team_a_id / team_b_id from the
 *                  current standings.
 *
 *   semifinal   -> when BOTH gold semifinals are finished, fill the gold
 *                  final (winners) and 3rd place match (losers).
 *
 *   silver_semifinal -> same idea for silver bracket (5-6 / 7-8).
 *
 * Idempotent: never overwrites a row that already has both teams filled,
 * so admins can manually adjust without losing the change on the next
 * status update.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { standingsForGroup } from "./ranking-helpers";
import type { Match, MatchSet } from "./db/types";

type DB = SupabaseClient;

interface MinimalMatch {
  id: string;
  phase: Match["phase"];
  group_label: Match["group_label"];
  status: Match["status"];
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_source: string | null;
  team_b_source: string | null;
  winner_team_id: string | null;
}

async function loadMatches(db: DB, tournamentId: string): Promise<MinimalMatch[]> {
  const { data, error } = await db
    .from("matches")
    .select(
      "id, phase, group_label, status, team_a_id, team_b_id, team_a_source, team_b_source, winner_team_id",
    )
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return (data ?? []) as MinimalMatch[];
}

async function loadSets(db: DB, matchIds: string[]): Promise<MatchSet[]> {
  if (matchIds.length === 0) return [];
  const { data, error } = await db
    .from("match_sets")
    .select("*")
    .in("match_id", matchIds);
  if (error) throw error;
  return (data ?? []) as MatchSet[];
}

/** Loser_team_id derived from winner_team_id + the two participants. */
function loserOf(m: MinimalMatch): string | null {
  if (!m.winner_team_id || !m.team_a_id || !m.team_b_id) return null;
  return m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
}

/** Update a match's team slots only if currently empty. */
async function setSlotsIfEmpty(
  db: DB,
  matchId: string,
  teamAId: string | null,
  teamBId: string | null,
) {
  if (!teamAId || !teamBId) return;
  const { data: cur } = await db
    .from("matches")
    .select("team_a_id, team_b_id")
    .eq("id", matchId)
    .single();
  if (cur?.team_a_id && cur?.team_b_id) return; // already filled, don't clobber
  await db
    .from("matches")
    .update({ team_a_id: teamAId, team_b_id: teamBId })
    .eq("id", matchId);
}

async function fillSemifinalsFromStandings(db: DB, tournamentId: string) {
  const matches = await loadMatches(db, tournamentId);
  const groupMatches = matches.filter((m) => m.phase === "group");
  if (groupMatches.some((m) => m.status !== "finished")) return; // not yet

  const sets = (await loadSets(
    db,
    groupMatches.map((m) => m.id),
  )) as MatchSet[];

  // standingsForGroup expects Match[] shape — minimal cast is fine since it
  // only uses phase/group_label/team_a_id/team_b_id/status/winner_team_id.
  const groupAIds = new Set<string>();
  const groupBIds = new Set<string>();
  for (const m of groupMatches) {
    if (m.group_label === "A") {
      if (m.team_a_id) groupAIds.add(m.team_a_id);
      if (m.team_b_id) groupAIds.add(m.team_b_id);
    } else if (m.group_label === "B") {
      if (m.team_a_id) groupBIds.add(m.team_a_id);
      if (m.team_b_id) groupBIds.add(m.team_b_id);
    }
  }
  const A = standingsForGroup(
    groupMatches as unknown as Match[],
    sets,
    "A",
    [...groupAIds],
  ).map((s) => s.teamId);
  const B = standingsForGroup(
    groupMatches as unknown as Match[],
    sets,
    "B",
    [...groupBIds],
  ).map((s) => s.teamId);

  for (const m of matches) {
    if (m.phase === "semifinal" && m.team_a_source === "A 組 #1") {
      await setSlotsIfEmpty(db, m.id, A[0] ?? null, B[1] ?? null);
    } else if (m.phase === "semifinal" && m.team_a_source === "B 組 #1") {
      await setSlotsIfEmpty(db, m.id, B[0] ?? null, A[1] ?? null);
    } else if (
      m.phase === "silver_semifinal" &&
      m.team_a_source === "A 組 #3"
    ) {
      await setSlotsIfEmpty(db, m.id, A[2] ?? null, B[3] ?? null);
    } else if (
      m.phase === "silver_semifinal" &&
      m.team_a_source === "B 組 #3"
    ) {
      await setSlotsIfEmpty(db, m.id, B[2] ?? null, A[3] ?? null);
    }
  }
}

async function fillFinalsFromSemis(
  db: DB,
  tournamentId: string,
  bracket: "gold" | "silver",
) {
  const matches = await loadMatches(db, tournamentId);
  const semiPhase = bracket === "gold" ? "semifinal" : "silver_semifinal";
  const finalPhase = bracket === "gold" ? "final" : "silver_final";
  const thirdPhase =
    bracket === "gold" ? "third_place" : "silver_third_place";

  const semis = matches.filter((m) => m.phase === semiPhase);
  if (semis.length !== 2) return;
  if (semis.some((m) => m.status !== "finished")) return;

  // identify which semi corresponds to "#1 source" so winner-of-#1 = teamA
  // of final (consistent ordering)
  const semi1 = semis.find(
    (m) =>
      m.team_a_source ===
      (bracket === "gold" ? "A 組 #1" : "A 組 #3"),
  );
  const semi2 = semis.find(
    (m) =>
      m.team_a_source ===
      (bracket === "gold" ? "B 組 #1" : "B 組 #3"),
  );
  if (!semi1 || !semi2) return;

  const w1 = semi1.winner_team_id;
  const w2 = semi2.winner_team_id;
  const l1 = loserOf(semi1);
  const l2 = loserOf(semi2);

  const finalMatch = matches.find((m) => m.phase === finalPhase);
  const thirdMatch = matches.find((m) => m.phase === thirdPhase);
  if (finalMatch) await setSlotsIfEmpty(db, finalMatch.id, w1, w2);
  if (thirdMatch) await setSlotsIfEmpty(db, thirdMatch.id, l1, l2);
}

export async function advanceBracketAfterFinish(
  db: DB,
  tournamentId: string,
  finishedPhase: Match["phase"],
) {
  try {
    if (finishedPhase === "group") {
      await fillSemifinalsFromStandings(db, tournamentId);
    } else if (finishedPhase === "semifinal") {
      await fillFinalsFromSemis(db, tournamentId, "gold");
    } else if (finishedPhase === "silver_semifinal") {
      await fillFinalsFromSemis(db, tournamentId, "silver");
    }
  } catch (err) {
    // Bracket advancement is best-effort — log and swallow so the
    // original status update still returns ok to the admin.
    console.error("advanceBracketAfterFinish failed", err);
  }
}
