/**
 * Tournament scheduler for VolleyPal.
 *
 * Every format is two groups (A, B) playing a round-robin, then a crossover
 * knockout: top 2 of each group into the Gold semis (A1 vs B2, B1 vs A2),
 * then final + 3rd place. What varies is the group size, how many times each
 * group plays itself, and the lower bracket — all of which `TournamentShape`
 * carries, derived in `lib/tournamentFormat.ts` from two numbers and the
 * placement toggles rather than enumerated.
 *
 * Court & time assignment is greedy: at each timeslot we fill as many courts
 * as possible with matches whose teams are not already playing this slot and
 * who did not play the previous slot (rest constraint, best-effort).
 */

import type { TournamentShape } from "./tournamentFormat";

export interface SchedulerTeam {
  id: string;
  groupLabel: "A" | "B";
}

export interface SchedulerInput {
  /** Must hold exactly `shape.numTeams`, split evenly between A and B. */
  teams: SchedulerTeam[];
  shape: TournamentShape;
  numCourts: number;
  matchDurationMin: number;
  /** ISO timestamp for the first match. */
  startsAt: Date;
}

export type Phase =
  | "group"
  | "semifinal"
  | "final"
  | "third_place"
  | "silver_semifinal"
  | "silver_final"
  | "silver_third_place";

export interface ScheduledMatch {
  phase: Phase;
  groupLabel: "A" | "B" | null;
  /** index within phase (0-based) — useful for debugging */
  index: number;
  teamAId: string | null;
  teamBId: string | null;
  /** Display source label when teamId is null (e.g. "Group A #1"). */
  teamASource?: string;
  teamBSource?: string;
  court: number;
  scheduledAt: Date;
  /** Team responsible for refereeing this match. Null when there aren't
   *  enough resting teams (e.g. court count is too high) or for knockout
   *  matches where the referee is assigned dynamically when the previous
   *  match finishes (loser refs the next). */
  refereeTeamId?: string | null;
}

export interface ScheduledTournament {
  groupMatches: ScheduledMatch[];
  knockoutMatches: ScheduledMatch[];
}

/**
 * Single round-robin: returns the list of [teamA, teamB] pairs.
 * For n=4 teams this is 6 matches. Order is deterministic.
 */
export function roundRobinPairs<T>(teams: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs;
}

interface PendingMatch {
  phase: Phase;
  groupLabel: "A" | "B" | null;
  index: number;
  teamAId: string;
  teamBId: string;
}

/**
 * Greedy timeslot/court assignment. Avoids same team on two courts at once
 * and tries to avoid back-to-back matches when possible.
 */
function assignCourtsAndTimes(
  matches: PendingMatch[],
  numCourts: number,
  matchDurationMin: number,
  startsAt: Date,
): ScheduledMatch[] {
  if (numCourts < 1) throw new Error("numCourts must be >= 1");
  const remaining = [...matches];
  const out: ScheduledMatch[] = [];
  let lastSlotTeams = new Set<string>();
  let slot = 0;

  while (remaining.length > 0) {
    const slotTeams = new Set<string>();
    const slotPicks: PendingMatch[] = [];

    // Prefer matches with no team that played last slot
    const preferred = remaining.filter(
      (m) => !lastSlotTeams.has(m.teamAId) && !lastSlotTeams.has(m.teamBId),
    );
    const fallback = remaining.filter((m) => !preferred.includes(m));

    for (const queue of [preferred, fallback]) {
      for (const m of queue) {
        if (slotPicks.length >= numCourts) break;
        if (slotTeams.has(m.teamAId) || slotTeams.has(m.teamBId)) continue;
        slotPicks.push(m);
        slotTeams.add(m.teamAId);
        slotTeams.add(m.teamBId);
      }
      if (slotPicks.length >= numCourts) break;
    }

    if (slotPicks.length === 0) {
      // Could not place any match this slot (shouldn't happen but safety)
      throw new Error("scheduler: deadlock — could not place any match");
    }

    slotPicks.forEach((m, courtIdx) => {
      out.push({
        phase: m.phase,
        groupLabel: m.groupLabel,
        index: m.index,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        court: courtIdx + 1,
        scheduledAt: new Date(
          startsAt.getTime() + slot * matchDurationMin * 60_000,
        ),
      });
      remaining.splice(remaining.indexOf(m), 1);
    });
    lastSlotTeams = slotTeams;
    slot++;
  }
  return out;
}

/**
 * Assign a referee team to each match by rotating through teams that aren't
 * playing in the current time slot.
 *
 * Ordering (first key wins):
 *   1. Fewest ref assignments so far — evens out total refereeing load so
 *      one team doesn't end up doing 3× what another does over the group
 *      stage. (In a 12-match / 6-slot / 2-court schedule that's 12 ref
 *      shifts spread across 8 teams — 1-2 shifts each when balanced.)
 *   2. Didn't ref last slot — spread the work in time, not just count.
 *   3. Didn't play last slot — resting teams get a real rest.
 *
 * Mutates the input array (sets refereeTeamId). If there aren't enough
 * resting teams in a slot (i.e. numCourts > floor(totalTeams/2)), some
 * matches are left with refereeTeamId = null.
 */
export function assignGroupRefs(
  matches: ScheduledMatch[],
  allTeamIds: string[],
): ScheduledMatch[] {
  const bySlot = new Map<number, ScheduledMatch[]>();
  for (const m of matches) {
    const k = m.scheduledAt.getTime();
    bySlot.set(k, [...(bySlot.get(k) ?? []), m]);
  }

  const sortedSlots = [...bySlot.entries()].sort(([a], [b]) => a - b);
  const refCount = new Map<string, number>();
  for (const id of allTeamIds) refCount.set(id, 0);
  let lastSlotPlaying = new Set<string>();
  let lastSlotRefs = new Set<string>();

  for (const [, slotMatches] of sortedSlots) {
    const playing = new Set<string>();
    for (const m of slotMatches) {
      if (m.teamAId) playing.add(m.teamAId);
      if (m.teamBId) playing.add(m.teamBId);
    }
    const resting = allTeamIds.filter((id) => !playing.has(id));

    // Tier: didn't-ref-last (2) + didn't-play-last (1). Higher = fresher.
    const tier = (id: string) =>
      (lastSlotRefs.has(id) ? 0 : 2) + (lastSlotPlaying.has(id) ? 0 : 1);
    const pool = [...resting].sort((a, b) => {
      const rc = (refCount.get(a) ?? 0) - (refCount.get(b) ?? 0);
      if (rc !== 0) return rc;
      return tier(b) - tier(a);
    });

    const used = new Set<string>();
    for (const m of slotMatches) {
      const ref = pool.find((id) => !used.has(id));
      if (ref) {
        m.refereeTeamId = ref;
        used.add(ref);
        refCount.set(ref, (refCount.get(ref) ?? 0) + 1);
      } else {
        m.refereeTeamId = null;
      }
    }
    lastSlotPlaying = playing;
    lastSlotRefs = used;
  }
  return matches;
}

export function scheduleGroupStage(
  input: SchedulerInput,
): ScheduledMatch[] {
  const { groupSize, groupRounds } = input.shape;
  const groupA = input.teams.filter((t) => t.groupLabel === "A");
  const groupB = input.teams.filter((t) => t.groupLabel === "B");
  if (groupA.length !== groupSize || groupB.length !== groupSize) {
    throw new Error(
      `scheduler: ${input.shape.numTeams} teams means ${groupSize} per group, got A=${groupA.length} B=${groupB.length}`,
    );
  }
  const pending: PendingMatch[] = [];
  for (const [label, group] of [
    ["A", groupA],
    ["B", groupB],
  ] as const) {
    let idx = 0;
    for (let round = 0; round < groupRounds; round++) {
      for (const [a, b] of roundRobinPairs(group)) {
        // Second time through, swap who is listed first. Nothing downstream
        // depends on the order, but it keeps the 對戰表 from showing the same
        // fixture twice in the same orientation, which reads like a bug.
        const [home, away] = round % 2 === 0 ? [a, b] : [b, a];
        pending.push({
          phase: "group",
          groupLabel: label,
          index: idx++,
          teamAId: home.id,
          teamBId: away.id,
        });
      }
    }
  }
  const scheduled = assignCourtsAndTimes(
    pending,
    input.numCourts,
    input.matchDurationMin,
    input.startsAt,
  );
  return assignGroupRefs(
    scheduled,
    input.teams.map((t) => t.id),
  );
}

/**
 * Source label for the single 5-6 match a "single" lower bracket produces.
 * Load-bearing: it's how autoFillKnockout tells that 5-6 match (filled from
 * the group standings the moment the groups end) apart from the 8-team
 * silver_final (filled from its own semis' winners).
 */
export const SILVER_DIRECT_SOURCE_A = "A 組 #3";
export const SILVER_DIRECT_SOURCE_B = "B 組 #3";

/**
 * Generate knockout shells (no team IDs yet) for both brackets.
 *
 * The DB phases are named semifinal / silver_semifinal etc. and stay that
 * way; the player-facing labels live in ScheduleList and Bracket and are
 * named by the places at stake instead, since "Silver bracket" is jargon
 * these players don't use.
 *
 * Upper bracket, identical in every shape (top 2 of each group, places 1-4):
 *   - Semi 1:   A 組 #1 vs B 組 #2
 *   - Semi 2:   B 組 #1 vs A 組 #2
 *   - 決賽:      Semi 1 W vs Semi 2 W   (1st vs 2nd)
 *   - 季軍賽:    Semi 1 L vs Semi 2 L   (3rd vs 4th)
 *
 * Lower bracket, per `shape.lowerBracket` — which is derived from the group
 * size rather than chosen, since the gold bracket always takes the top 2 and
 * what's left over is whatever the group size leaves over:
 *   "semis"  (groups of 4+ — #3 and #4 of each group play for places 5-8)
 *   - Semi S1:  A 組 #3 vs B 組 #4
 *   - Semi S2:  B 組 #3 vs A 組 #4
 *   - 5-6 名:    Semi S1 W vs Semi S2 W
 *   - 7-8 名:    Semi S1 L vs Semi S2 L
 *
 *   "single" (groups of 3 — one match between the group thirds)
 *   - 5-6 名:    A 組 #3 vs B 組 #3
 *     Runs in the FIRST knockout wave, not the second: it depends only on the
 *     group standings, so making it wait for the gold semis would idle a
 *     court and push the finals a slot later for no reason.
 *
 *   "none"   nothing — 5th and below stand on group record. Also what you
 *            get from 不打排位賽, which is a placement toggle, not a shape.
 *
 * Scheduled in two waves (everything that depends only on groups, then
 * everything that depends on a semi). Within a wave, matches fill courts in
 * order; if a wave has more matches than courts it spills into more slots.
 */
export function buildKnockoutShells(
  shape: TournamentShape,
  startsAt: Date,
  matchDurationMin: number,
  numCourts: number,
): ScheduledMatch[] {
  type Shell = Omit<ScheduledMatch, "court" | "scheduledAt">;

  const semis: Shell[] = [
    {
      phase: "semifinal",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: "A 組 #1",
      teamBSource: "B 組 #2",
    },
    {
      phase: "semifinal",
      groupLabel: null,
      index: 1,
      teamAId: null,
      teamBId: null,
      teamASource: "B 組 #1",
      teamBSource: "A 組 #2",
    },
  ];

  if (shape.lowerBracket === "semis") {
    semis.push(
      {
        phase: "silver_semifinal",
        groupLabel: null,
        index: 0,
        teamAId: null,
        teamBId: null,
        teamASource: SILVER_DIRECT_SOURCE_A,
        teamBSource: "B 組 #4",
      },
      {
        phase: "silver_semifinal",
        groupLabel: null,
        index: 1,
        teamAId: null,
        teamBId: null,
        teamASource: SILVER_DIRECT_SOURCE_B,
        teamBSource: "A 組 #4",
      },
    );
  } else if (
    shape.lowerBracket === "single" &&
    !shape.skipSilverThirdPlace
  ) {
    semis.push({
      phase: "silver_final",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: SILVER_DIRECT_SOURCE_A,
      teamBSource: SILVER_DIRECT_SOURCE_B,
    });
  }

  const finals: Shell[] = [
    {
      phase: "final",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: "準決賽 1 勝者",
      teamBSource: "準決賽 2 勝者",
    },
    ...(shape.skipThirdPlace
      ? []
      : [
          {
            phase: "third_place" as const,
            groupLabel: null,
            index: 0,
            teamAId: null,
            teamBId: null,
            teamASource: "準決賽 1 敗者",
            teamBSource: "準決賽 2 敗者",
          },
        ]),
    ...(shape.lowerBracket === "semis"
      ? [
          {
            phase: "silver_final" as const,
            groupLabel: null,
            index: 0,
            teamAId: null,
            teamBId: null,
            teamASource: "5-8 準決賽 1 勝者",
            teamBSource: "5-8 準決賽 2 勝者",
          },
          ...(shape.skipSilverThirdPlace
            ? []
            : [
                {
                  phase: "silver_third_place" as const,
                  groupLabel: null,
                  index: 0,
                  teamAId: null,
                  teamBId: null,
                  teamASource: "5-8 準決賽 1 敗者",
                  teamBSource: "5-8 準決賽 2 敗者",
                },
              ]),
        ]
      : []),
  ];

  const out: ScheduledMatch[] = [];
  let slot = 0;
  for (const round of [semis, finals]) {
    const pending = [...round];
    while (pending.length > 0) {
      const chunk = pending.splice(0, numCourts);
      chunk.forEach((m, i) => {
        out.push({
          ...m,
          court: i + 1,
          scheduledAt: new Date(
            startsAt.getTime() + slot * matchDurationMin * 60_000,
          ),
        });
      });
      slot++;
    }
  }
  return out;
}

export function buildFullSchedule(input: SchedulerInput): ScheduledTournament {
  const groupMatches = scheduleGroupStage(input);
  const lastGroupTime = groupMatches.reduce(
    (max, m) => (m.scheduledAt > max ? m.scheduledAt : max),
    groupMatches[0]?.scheduledAt ?? input.startsAt,
  );
  const knockoutStart = new Date(
    lastGroupTime.getTime() + input.matchDurationMin * 60_000,
  );
  const knockoutMatches = buildKnockoutShells(
    input.shape,
    knockoutStart,
    input.matchDurationMin,
    input.numCourts,
  );
  return { groupMatches, knockoutMatches };
}

/**
 * After group stage results are known, fill the semifinal matches (both
 * both brackets) with real team IDs. Final / silver_final /
 * third_place / silver_third_place stay TBD until their respective semis end.
 *
 * groupAStandings[0] = A1, [1] = A2, [2] = A3, [3] = A4 (same for B).
 *
 * A "single" lower bracket's 5-6 match is filled here too: it reads straight
 * off the standings rather than waiting on a semi, which is the whole reason
 * it's scheduled in the first knockout wave.
 */
export function fillKnockoutTeams(
  knockout: ScheduledMatch[],
  groupAStandings: string[],
  groupBStandings: string[],
): ScheduledMatch[] {
  const A = groupAStandings;
  const B = groupBStandings;
  return knockout.map((m) => {
    if (m.phase === "semifinal" && m.teamASource === "A 組 #1") {
      return { ...m, teamAId: A[0] ?? null, teamBId: B[1] ?? null };
    }
    if (m.phase === "semifinal" && m.teamASource === "B 組 #1") {
      return { ...m, teamAId: B[0] ?? null, teamBId: A[1] ?? null };
    }
    if (m.phase === "silver_semifinal" && m.teamASource === "A 組 #3") {
      return { ...m, teamAId: A[2] ?? null, teamBId: B[3] ?? null };
    }
    if (m.phase === "silver_semifinal" && m.teamASource === "B 組 #3") {
      return { ...m, teamAId: B[2] ?? null, teamBId: A[3] ?? null };
    }
    if (
      m.phase === "silver_final" &&
      m.teamASource === SILVER_DIRECT_SOURCE_A &&
      m.teamBSource === SILVER_DIRECT_SOURCE_B
    ) {
      return { ...m, teamAId: A[2] ?? null, teamBId: B[2] ?? null };
    }
    return m;
  });
}
