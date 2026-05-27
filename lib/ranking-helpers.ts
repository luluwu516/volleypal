import type { Match, MatchSet } from "./db/types";
import type { MatchResult, StandingRow } from "./ranking";
import { buildStandings } from "./ranking";

/**
 * Turn DB matches + sets into the MatchResult shape expected by
 * buildStandings. Only finished matches count toward standings.
 */
export function matchesToResults(
  matches: Match[],
  sets: MatchSet[],
): MatchResult[] {
  const setsByMatch = new Map<string, MatchSet[]>();
  for (const s of sets) {
    const list = setsByMatch.get(s.match_id) ?? [];
    list.push(s);
    setsByMatch.set(s.match_id, list);
  }
  const results: MatchResult[] = [];
  for (const m of matches) {
    if (m.status !== "finished") continue;
    if (!m.team_a_id || !m.team_b_id || !m.winner_team_id) continue;
    const matchSets = (setsByMatch.get(m.id) ?? []).sort(
      (a, b) => a.set_no - b.set_no,
    );
    results.push({
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
      winnerTeamId: m.winner_team_id,
      sets: matchSets.map((s) => ({ scoreA: s.score_a, scoreB: s.score_b })),
    });
  }
  return results;
}

export function standingsForGroup(
  matches: Match[],
  sets: MatchSet[],
  group: "A" | "B",
  teamIds: string[],
): StandingRow[] {
  const groupMatches = matches.filter(
    (m) => m.phase === "group" && m.group_label === group,
  );
  return buildStandings(teamIds, matchesToResults(groupMatches, sets));
}
