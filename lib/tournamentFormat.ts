/**
 * Derives the shape of a tournament from its settings.
 *
 * This started life as an enum of named formats ("8 teams, groups of 4, gold
 * and silver"), which was wrong twice over. Team count is a NUMBER, so
 * enumerating it means a new enum value and a migration every time a roster
 * is a different size. And "only play the gold bracket" isn't a format at all
 * — it's switching an optional placement match off, which is the same axis as
 * 不打季軍賽 and belongs with it.
 *
 * So the settings are:
 *   numTeams     — how many teams, split into two equal groups
 *   groupRounds  — how many times each group plays itself through
 *   the placement toggles — which optional matches to actually play
 *
 * and everything else, the lower bracket included, is derived. The lower
 * bracket is not a choice: the gold bracket always takes the top 2 of each
 * group, so what's left over is whatever the group size leaves over.
 *
 *   group of 2 → nothing left, no lower bracket
 *   group of 3 → one team each, a single 5-6 game
 *   group of 4 → two each, crossover semis for places 5-8
 *   group of 5+ → two each into those semis; #5 and below take their
 *                 placement from group record, as they would anyway
 *
 * That makes 4, 6, 8, 10, 12… all fall out of one rule with no new options.
 */

import type { GroupingStrategy } from "./db/types";

export const MIN_TEAMS = 4;
export const MAX_TEAMS = 16;

/**
 * Grouping strategies that can only ever produce 8 teams.
 *
 * The `*_together` strategies bucket the roster into the 4 zodiac elements
 * (or 4 MBTI temperaments) and split each bucket in half, so the count is
 * 4 × 2 by construction. Asking one for 6 teams would mean abandoning the one
 * property it exists for — that teammates share an attribute — so there is no
 * sensible 6-team version of it, only a different strategy.
 */
export const FIXED_EIGHT_STRATEGIES: readonly GroupingStrategy[] = [
  "zodiac_together",
  "mbti_together",
];

/** The strategy to fall back to when the team count rules one out. */
export const MIXED_COUNTERPART: Record<GroupingStrategy, GroupingStrategy> = {
  zodiac_together: "zodiac_mixed",
  mbti_together: "mbti_mixed",
  zodiac_mixed: "zodiac_mixed",
  mbti_mixed: "mbti_mixed",
};

/** Whether a strategy can produce this many teams. */
export function teamCountSupported(
  strategy: GroupingStrategy,
  teamCount: number,
): boolean {
  return FIXED_EIGHT_STRATEGIES.includes(strategy)
    ? teamCount === 8
    : teamCount >= 2;
}

export interface FormatSettings {
  numTeams: number;
  groupRounds: number;
  skipThirdPlace?: boolean;
  /**
   * Drop the lower bracket entirely; 5th and below rank on group record.
   * Shown to admins as 不打排位賽 — the DB column and these fields keep the
   * "silver" name, but no player-facing string uses it.
   */
  skipSilverBracket?: boolean;
  /**
   * Drop the LAST lower-bracket placement match — the 7-8 game when the
   * bracket has semis, the 5-6 game when it's a single match. The teams it
   * would have separated are displayed as tied.
   */
  skipSilverThirdPlace?: boolean;
}

export interface TournamentShape {
  numTeams: number;
  /** Teams per group. Both groups are equal, always numTeams / 2. */
  groupSize: number;
  groupRounds: number;
  lowerBracket: "semis" | "single" | "none";
  /**
   * Teams per group that play no knockout match at all, because the gold and
   * lower brackets between them don't reach that far down the group. Their
   * final placement comes from the standings table.
   */
  unbracketedPerGroup: number;
  skipThirdPlace: boolean;
  skipSilverThirdPlace: boolean;
  groupMatches: number;
  knockoutMatches: number;
  totalMatches: number;
}

export function isValidTeamCount(n: number): boolean {
  return (
    Number.isInteger(n) && n >= MIN_TEAMS && n <= MAX_TEAMS && n % 2 === 0
  );
}

/** Even counts in range — what the settings picker offers. */
export function teamCountOptions(): number[] {
  const out: number[] = [];
  for (let n = MIN_TEAMS; n <= MAX_TEAMS; n += 2) out.push(n);
  return out;
}

export function clampTeamCount(n: number | null | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 8;
  const even = Math.round(n / 2) * 2;
  return Math.min(Math.max(even, MIN_TEAMS), MAX_TEAMS);
}

export function clampGroupRounds(n: number | null | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.round(n), 1), 2);
}

export function tournamentShape(s: FormatSettings): TournamentShape {
  const numTeams = clampTeamCount(s.numTeams);
  const groupRounds = clampGroupRounds(s.groupRounds);
  const groupSize = numTeams / 2;

  const lowerBracket: TournamentShape["lowerBracket"] = s.skipSilverBracket
    ? "none"
    : groupSize >= 4
      ? "semis"
      : groupSize === 3
        ? "single"
        : "none";

  // How far down each group the brackets reach: gold takes 2, then whatever
  // the lower bracket takes on top of that.
  const bracketed =
    2 + (lowerBracket === "semis" ? 2 : lowerBracket === "single" ? 1 : 0);
  const unbracketedPerGroup = Math.max(0, groupSize - bracketed);

  const skipThirdPlace = Boolean(s.skipThirdPlace);
  const skipSilverThirdPlace = Boolean(s.skipSilverThirdPlace);

  const perGroup = (groupSize * (groupSize - 1)) / 2;
  const groupMatches = perGroup * 2 * groupRounds;

  // Gold is the same in every shape: two semis, a final, and a 3rd-place
  // match unless it's switched off.
  let knockoutMatches = 3 + (skipThirdPlace ? 0 : 1);
  if (lowerBracket === "semis") {
    knockoutMatches += 3 + (skipSilverThirdPlace ? 0 : 1);
  } else if (lowerBracket === "single") {
    knockoutMatches += skipSilverThirdPlace ? 0 : 1;
  }

  return {
    numTeams,
    groupSize,
    groupRounds,
    lowerBracket,
    unbracketedPerGroup,
    skipThirdPlace,
    skipSilverThirdPlace,
    groupMatches,
    knockoutMatches,
    totalMatches: groupMatches + knockoutMatches,
  };
}

/** Human summary of what this configuration will actually play. */
export function describeShape(shape: TournamentShape): string {
  const parts = [
    `兩組各 ${shape.groupSize} 隊,${shape.groupRounds === 2 ? "各打兩輪" : "單循環"} ${shape.groupMatches} 場`,
  ];
  parts.push("爭冠組打 1-4 名");
  if (shape.lowerBracket === "semis") {
    parts.push(
      shape.skipSilverThirdPlace
        ? "排位賽打 5-8 名(不打 7-8)"
        : "排位賽打 5-8 名",
    );
  } else if (shape.lowerBracket === "single") {
    parts.push(shape.skipSilverThirdPlace ? "無 5-6 名戰" : "一場定 5-6 名");
  }
  if (shape.unbracketedPerGroup > 0) {
    const from = 2 + (shape.lowerBracket === "semis" ? 2 : shape.lowerBracket === "single" ? 1 : 0);
    parts.push(`各組第 ${from + 1} 名以後依小組戰績排名`);
  } else if (shape.lowerBracket === "none" && shape.groupSize > 2) {
    parts.push("5 名以後依小組戰績排名");
  }
  return parts.join(",") + "。";
}

/**
 * How many matches a single slot can really hold.
 *
 * Not simply `numCourts`: group matches are within a group, and a group of g
 * can only have floor(g / 2) of its teams paired up at once, so two groups
 * cap a slot at 2 × floor(g / 2) however many courts are free. That's why 6
 * teams never fill a third court — groups of 3 manage one match each per slot
 * — and why a naive 3 × numCourts rule over-warns there.
 */
export function maxConcurrentMatches(
  numTeams: number,
  numCourts: number,
): number {
  const groupSize = clampTeamCount(numTeams) / 2;
  return Math.min(Math.max(1, numCourts), 2 * Math.floor(groupSize / 2));
}

/**
 * Whether every group match can be handed a referee drawn from a team that is
 * resting that slot.
 *
 * A slot running k matches has 2k teams on court and needs k more to referee
 * them, so it needs 3k teams in total. Below that the arithmetic doesn't
 * close and `assignGroupRefs` leaves the leftover matches with no referee at
 * all — worth saying out loud on the settings screen, because adding a third
 * court to an 8-team tournament looks like a free speed-up and isn't: it
 * wants a 9th team, and in exchange for the unreferreed matches it saves one
 * slot out of six.
 */
export function refereeCoverage(
  numTeams: number,
  numCourts: number,
): {
  ok: boolean;
  /** Matches that will actually run at once, which may be under numCourts. */
  concurrent: number;
  playing: number;
  resting: number;
  minTeams: number;
  /** Most courts this many teams can keep refereed. */
  maxCourts: number;
} {
  const teams = clampTeamCount(numTeams);
  const concurrent = maxConcurrentMatches(teams, numCourts);
  const playing = concurrent * 2;
  const resting = teams - playing;

  let maxCourts = 1;
  for (let c = 1; c <= 8; c++) {
    const k = maxConcurrentMatches(teams, c);
    if (teams - 2 * k >= k) maxCourts = c;
  }

  return {
    ok: resting >= concurrent,
    concurrent,
    playing,
    resting,
    minTeams: 3 * concurrent,
    maxCourts,
  };
}

/**
 * Wall-clock slots the schedule needs, assuming every court stays busy. A
 * floor rather than a promise — the group scheduler also enforces a rest
 * constraint, which can leave a court idle in a slot.
 */
export function minSlotCount(
  shape: TournamentShape,
  numCourts: number,
): number {
  const courts = Math.max(1, numCourts);
  const groupSlots = Math.ceil(shape.groupMatches / courts);
  // The knockout runs in two waves: everything that depends only on the group
  // standings, then everything that waits on a semi result.
  const firstWave =
    2 +
    (shape.lowerBracket === "semis"
      ? 2
      : shape.lowerBracket === "single" && !shape.skipSilverThirdPlace
        ? 1
        : 0);
  const secondWave = Math.max(0, shape.knockoutMatches - firstWave);
  return (
    groupSlots + Math.ceil(firstWave / courts) + Math.ceil(secondWave / courts)
  );
}
