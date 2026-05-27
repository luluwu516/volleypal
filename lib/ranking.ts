/**
 * Pool-play ranking for VolleyPal.
 *
 * Tiebreak order:
 *   1. Wins (most)
 *   2. Points = total points scored across all sets (most)
 *   3. Set ratio (sets won / sets lost; higher is better)
 *   4. Point ratio (points won / points lost; higher = more efficient)
 *
 * In time-limited group play, a match may end with the leading team winning
 * a partial set — we still count whoever has more sets-won (or points-won
 * if sets tied) as the winner. Forfeits are recorded as 0-2 set, 0-N points.
 */

export interface MatchResult {
  teamAId: string;
  teamBId: string;
  /** Per-set scores; e.g. [{a:25,b:23},{a:22,b:25},{a:15,b:10}] */
  sets: Array<{ scoreA: number; scoreB: number }>;
  /** If true, the LOSER (the team not in winnerTeamId) forfeited. */
  forfeit?: boolean;
  winnerTeamId: string;
}

export interface StandingRow {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  forfeitLosses: number;
  /** Tiebreak metric — sum of all points scored across all matches/sets. */
  points: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  setRatio: number;
  pointRatio: number;
}

export function emptyRow(teamId: string): StandingRow {
  return {
    teamId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    forfeitLosses: 0,
    points: 0,
    setsWon: 0,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
    setRatio: 0,
    pointRatio: 0,
  };
}

function applyResult(row: StandingRow, opp: "A" | "B", result: MatchResult) {
  let setsWonByA = 0;
  let setsWonByB = 0;
  let pointsA = 0;
  let pointsB = 0;
  for (const s of result.sets) {
    pointsA += s.scoreA;
    pointsB += s.scoreB;
    if (s.scoreA > s.scoreB) setsWonByA++;
    else if (s.scoreB > s.scoreA) setsWonByB++;
  }
  const teamWon =
    (opp === "A" && result.winnerTeamId === result.teamAId) ||
    (opp === "B" && result.winnerTeamId === result.teamBId);
  row.matchesPlayed += 1;
  if (opp === "A") {
    row.setsWon += setsWonByA;
    row.setsLost += setsWonByB;
    row.pointsWon += pointsA;
    row.pointsLost += pointsB;
  } else {
    row.setsWon += setsWonByB;
    row.setsLost += setsWonByA;
    row.pointsWon += pointsB;
    row.pointsLost += pointsA;
  }
  if (teamWon) {
    row.wins += 1;
  } else {
    row.losses += 1;
    if (result.forfeit) row.forfeitLosses += 1;
  }
}

function finalize(row: StandingRow): StandingRow {
  row.points = row.pointsWon;
  row.setRatio = row.setsLost === 0 ? row.setsWon : row.setsWon / row.setsLost;
  row.pointRatio =
    row.pointsLost === 0 ? row.pointsWon : row.pointsWon / row.pointsLost;
  return row;
}

export function buildStandings(
  teamIds: string[],
  results: MatchResult[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of teamIds) rows.set(id, emptyRow(id));
  for (const r of results) {
    if (rows.has(r.teamAId)) applyResult(rows.get(r.teamAId)!, "A", r);
    if (rows.has(r.teamBId)) applyResult(rows.get(r.teamBId)!, "B", r);
  }
  return [...rows.values()].map(finalize).sort(compareStandings);
}

export function compareStandings(a: StandingRow, b: StandingRow): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.points !== a.points) return b.points - a.points;
  if (b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;
  if (b.pointRatio !== a.pointRatio) return b.pointRatio - a.pointRatio;
  return a.teamId.localeCompare(b.teamId);
}

export function topNTeamIds(standings: StandingRow[], n: number): string[] {
  return standings.slice(0, n).map((s) => s.teamId);
}
