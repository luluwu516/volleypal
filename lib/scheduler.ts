/**
 * Tournament scheduler for VolleyPal.
 *
 * Format: 8 teams split into two groups of 4 (A, B). Each group plays a single
 * round-robin (6 matches per group, 12 total). Top 2 from each group advance
 * to a crossover semifinal (A1 vs B2, B1 vs A2), then final + third-place.
 *
 * Court & time assignment is greedy: at each timeslot we fill as many courts
 * as possible with matches whose teams are not already playing this slot and
 * who did not play the previous slot (rest constraint, best-effort).
 */

export interface SchedulerTeam {
  id: string;
  groupLabel: "A" | "B";
}

export interface SchedulerInput {
  teams: SchedulerTeam[]; // expects 8 teams, 4 per group
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
 * playing in the current time slot. Avoids same team refereeing two slots in
 * a row when alternatives exist; also avoids the team that played the
 * previous slot (so they get a real rest).
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
  let lastSlotPlaying = new Set<string>();
  let lastSlotRefs = new Set<string>();

  for (const [, slotMatches] of sortedSlots) {
    const playing = new Set<string>();
    for (const m of slotMatches) {
      if (m.teamAId) playing.add(m.teamAId);
      if (m.teamBId) playing.add(m.teamBId);
    }
    const resting = allTeamIds.filter((id) => !playing.has(id));

    // Preference order: didn't ref last slot AND didn't play last slot >
    //                   didn't ref last slot >
    //                   didn't play last slot >
    //                   anyone resting
    const tier = (id: string) =>
      (lastSlotRefs.has(id) ? 0 : 2) + (lastSlotPlaying.has(id) ? 0 : 1);
    const pool = [...resting].sort((a, b) => tier(b) - tier(a));

    const used = new Set<string>();
    for (const m of slotMatches) {
      const ref = pool.find((id) => !used.has(id));
      if (ref) {
        m.refereeTeamId = ref;
        used.add(ref);
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
  const groupA = input.teams.filter((t) => t.groupLabel === "A");
  const groupB = input.teams.filter((t) => t.groupLabel === "B");
  if (groupA.length !== 4 || groupB.length !== 4) {
    throw new Error(
      `scheduler: expected 4 teams per group, got A=${groupA.length} B=${groupB.length}`,
    );
  }
  const pending: PendingMatch[] = [];
  let idx = 0;
  for (const [a, b] of roundRobinPairs(groupA)) {
    pending.push({
      phase: "group",
      groupLabel: "A",
      index: idx++,
      teamAId: a.id,
      teamBId: b.id,
    });
  }
  idx = 0;
  for (const [a, b] of roundRobinPairs(groupB)) {
    pending.push({
      phase: "group",
      groupLabel: "B",
      index: idx++,
      teamAId: a.id,
      teamBId: b.id,
    });
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
 * Generate knockout shells (no team IDs yet) for the Gold and Silver brackets.
 *
 * Gold bracket (top 2 from each group play for places 1-4):
 *   - Semi G1: A 組 #1 vs B 組 #2
 *   - Semi G2: B 組 #1 vs A 組 #2
 *   - Final:        Semi G1 W vs Semi G2 W   (1st vs 2nd)
 *   - 3rd Place:    Semi G1 L vs Semi G2 L   (3rd vs 4th)
 *
 * Silver bracket (bottom 2 from each group play for places 5-8):
 *   - Semi S1: A 組 #3 vs B 組 #4
 *   - Semi S2: B 組 #3 vs A 組 #4
 *   - Silver Final: Semi S1 W vs Semi S2 W   (5th vs 6th)
 *   - 7-8 Place:    Semi S1 L vs Semi S2 L   (7th vs 8th)
 *
 * 8 matches total. Scheduled in two rounds (semis, then finals).
 * Within a round, matches fill courts in order; if more matches than courts,
 * the round spills into multiple time slots.
 */
export function buildKnockoutShells(
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
    {
      phase: "silver_semifinal",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: "A 組 #3",
      teamBSource: "B 組 #4",
    },
    {
      phase: "silver_semifinal",
      groupLabel: null,
      index: 1,
      teamAId: null,
      teamBId: null,
      teamASource: "B 組 #3",
      teamBSource: "A 組 #4",
    },
  ];

  const finals: Shell[] = [
    {
      phase: "final",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: "Gold Semi 1 W",
      teamBSource: "Gold Semi 2 W",
    },
    {
      phase: "third_place",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: "Gold Semi 1 L",
      teamBSource: "Gold Semi 2 L",
    },
    {
      phase: "silver_final",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: "Silver Semi 1 W",
      teamBSource: "Silver Semi 2 W",
    },
    {
      phase: "silver_third_place",
      groupLabel: null,
      index: 0,
      teamAId: null,
      teamBId: null,
      teamASource: "Silver Semi 1 L",
      teamBSource: "Silver Semi 2 L",
    },
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
    knockoutStart,
    input.matchDurationMin,
    input.numCourts,
  );
  return { groupMatches, knockoutMatches };
}

/**
 * After group stage results are known, fill the semifinal matches (both
 * Gold and Silver brackets) with real team IDs. Final / silver_final /
 * third_place / silver_third_place stay TBD until their respective semis end.
 *
 * groupAStandings[0] = A1, [1] = A2, [2] = A3, [3] = A4 (same for B).
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
    return m;
  });
}
