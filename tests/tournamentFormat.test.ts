import { describe, it, expect } from "vitest";
import {
  tournamentShape,
  teamCountOptions,
  clampTeamCount,
  clampGroupRounds,
  isValidTeamCount,
  minSlotCount,
  refereeCoverage,
  maxConcurrentMatches,
  describeShape,
  MIN_TEAMS,
  MAX_TEAMS,
  teamCountSupported,
  MIXED_COUNTERPART,
  FIXED_EIGHT_STRATEGIES,
  type FormatSettings,
} from "../lib/tournamentFormat";
import { buildFullSchedule, type SchedulerTeam } from "../lib/scheduler";
import type { GroupingStrategy } from "../lib/db/types";

function teamsFor(groupSize: number): SchedulerTeam[] {
  const out: SchedulerTeam[] = [];
  for (let i = 0; i < groupSize; i++) {
    out.push({ id: `a${i + 1}`, groupLabel: "A" });
  }
  for (let i = 0; i < groupSize; i++) {
    out.push({ id: `b${i + 1}`, groupLabel: "B" });
  }
  return out;
}

const TOGGLE_COMBOS: Partial<FormatSettings>[] = [
  {},
  { skipThirdPlace: true },
  { skipSilverThirdPlace: true },
  { skipSilverBracket: true },
  { skipThirdPlace: true, skipSilverThirdPlace: true },
  { skipThirdPlace: true, skipSilverBracket: true },
];

describe("lower bracket is derived from group size, not chosen", () => {
  // The gold bracket always takes the top 2 of each group, so what's left for
  // a lower bracket is whatever the group size leaves over. This is the rule
  // that replaced an enum of named formats — if it holds, adding 10 or 12
  // teams needs no new settings at all.
  it("groups of 2 have nobody left over", () => {
    const s = tournamentShape({ numTeams: 4, groupRounds: 1 });
    expect(s.groupSize).toBe(2);
    expect(s.lowerBracket).toBe("none");
    expect(s.unbracketedPerGroup).toBe(0);
  });

  it("groups of 3 leave one team each — a single 5-6 game", () => {
    const s = tournamentShape({ numTeams: 6, groupRounds: 1 });
    expect(s.lowerBracket).toBe("single");
    expect(s.unbracketedPerGroup).toBe(0);
  });

  it("groups of 4 leave two each — crossover semis for 5-8", () => {
    const s = tournamentShape({ numTeams: 8, groupRounds: 1 });
    expect(s.lowerBracket).toBe("semis");
    expect(s.unbracketedPerGroup).toBe(0);
  });

  it("groups of 5+ fill the semis and rank the rest on group record", () => {
    const ten = tournamentShape({ numTeams: 10, groupRounds: 1 });
    expect(ten.lowerBracket).toBe("semis");
    expect(ten.unbracketedPerGroup).toBe(1);
    const twelve = tournamentShape({ numTeams: 12, groupRounds: 1 });
    expect(twelve.unbracketedPerGroup).toBe(2);
  });

  it("不打銀盃 overrides the derivation at any size", () => {
    for (const numTeams of teamCountOptions()) {
      const s = tournamentShape({
        numTeams,
        groupRounds: 1,
        skipSilverBracket: true,
      });
      expect(s.lowerBracket).toBe("none");
      expect(s.knockoutMatches).toBeLessThanOrEqual(4);
    }
  });
});

describe("team count validation", () => {
  it("accepts even counts in range and nothing else", () => {
    expect(isValidTeamCount(8)).toBe(true);
    expect(isValidTeamCount(7)).toBe(false);
    expect(isValidTeamCount(MIN_TEAMS - 2)).toBe(false);
    expect(isValidTeamCount(MAX_TEAMS + 2)).toBe(false);
    expect(isValidTeamCount(8.5)).toBe(false);
  });

  it("every offered option is valid and splits into two equal groups", () => {
    for (const n of teamCountOptions()) {
      expect(isValidTeamCount(n)).toBe(true);
      expect(tournamentShape({ numTeams: n, groupRounds: 1 }).groupSize * 2).toBe(
        n,
      );
    }
  });

  it("clamps junk to something schedulable", () => {
    // These come off a DB column that may predate the setting, so the clamps
    // stand in for a row that simply has no answer yet.
    expect(clampTeamCount(null)).toBe(8);
    expect(clampTeamCount(undefined)).toBe(8);
    expect(clampTeamCount(7)).toBe(8);
    expect(clampTeamCount(1)).toBe(MIN_TEAMS);
    expect(clampTeamCount(999)).toBe(MAX_TEAMS);
    expect(isValidTeamCount(clampTeamCount(NaN))).toBe(true);
    expect(clampGroupRounds(null)).toBe(1);
    expect(clampGroupRounds(9)).toBe(2);
    expect(clampGroupRounds(0)).toBe(1);
  });
});

describe("advertised match counts match what the scheduler builds", () => {
  // The settings screen shows these numbers to an admin deciding whether a
  // configuration fits the venue booking. If this arithmetic and the
  // scheduler ever disagree, that screen becomes a confident lie at the exact
  // moment someone is budgeting court time — so cross-check them directly
  // rather than asserting the arithmetic against itself.
  for (const numTeams of teamCountOptions()) {
    for (const groupRounds of [1, 2]) {
      for (const toggles of TOGGLE_COMBOS) {
        it(`${numTeams} teams × ${groupRounds} ${JSON.stringify(toggles)}`, () => {
          const shape = tournamentShape({ numTeams, groupRounds, ...toggles });
          const { groupMatches, knockoutMatches } = buildFullSchedule({
            teams: teamsFor(shape.groupSize),
            shape,
            numCourts: 2,
            matchDurationMin: 30,
            startsAt: new Date("2026-06-01T09:00:00-07:00"),
          });
          expect(groupMatches).toHaveLength(shape.groupMatches);
          expect(knockoutMatches).toHaveLength(shape.knockoutMatches);
          expect(groupMatches.length + knockoutMatches.length).toBe(
            shape.totalMatches,
          );
        });
      }
    }
  }
});

describe("minSlotCount", () => {
  it("never promises fewer slots than the schedule actually uses", () => {
    // Documented as a floor — the group stage's rest constraint can add a
    // slot — so the one thing it must never do is overstate how early the
    // event finishes.
    for (const numTeams of teamCountOptions()) {
      for (const numCourts of [1, 2, 3]) {
        const shape = tournamentShape({ numTeams, groupRounds: 1 });
        const { groupMatches, knockoutMatches } = buildFullSchedule({
          teams: teamsFor(shape.groupSize),
          shape,
          numCourts,
          matchDurationMin: 30,
          startsAt: new Date("2026-06-01T09:00:00-07:00"),
        });
        const slots = new Set(
          [...groupMatches, ...knockoutMatches].map((m) =>
            m.scheduledAt.getTime(),
          ),
        );
        expect(
          minSlotCount(shape, numCourts),
          `${numTeams} teams on ${numCourts} courts`,
        ).toBeLessThanOrEqual(slots.size);
      }
    }
  });

  it("needs fewer slots as courts are added", () => {
    const shape = tournamentShape({ numTeams: 8, groupRounds: 1 });
    expect(minSlotCount(shape, 1)).toBeGreaterThan(minSlotCount(shape, 2));
  });
});

describe("describeShape", () => {
  it("names the lower bracket it actually produces", () => {
    expect(describeShape(tournamentShape({ numTeams: 8, groupRounds: 1 }))).toContain(
      "排位賽打 5-8 名",
    );
    expect(describeShape(tournamentShape({ numTeams: 6, groupRounds: 1 }))).toContain(
      "一場定 5-6 名",
    );
    expect(
      describeShape(
        tournamentShape({ numTeams: 8, groupRounds: 1, skipSilverBracket: true }),
      ),
    ).toContain("小組戰績");
    expect(describeShape(tournamentShape({ numTeams: 6, groupRounds: 2 }))).toContain(
      "各打兩輪",
    );
  });
});

describe("refereeCoverage", () => {
  it("matches what the scheduler can actually staff", () => {
    // The rule is numTeams >= 3 * numCourts: a slot puts 2 per court on the
    // floor and needs one more team per court to referee. Checked against the
    // scheduler's own output rather than restated, because the warning this
    // drives is the only thing standing between an admin and discovering at
    // the venue that a third court left matches unrefereed.
    for (const numTeams of teamCountOptions()) {
      for (const numCourts of [1, 2, 3, 4]) {
        const shape = tournamentShape({ numTeams, groupRounds: 1 });
        const { groupMatches } = buildFullSchedule({
          teams: teamsFor(shape.groupSize),
          shape,
          numCourts,
          matchDurationMin: 30,
          startsAt: new Date("2026-06-01T09:00:00-07:00"),
        });
        const unrefereed = groupMatches.filter((m) => !m.refereeTeamId).length;
        const { ok } = refereeCoverage(numTeams, numCourts);
        expect(
          unrefereed === 0,
          `${numTeams} teams on ${numCourts} courts: ${unrefereed} unrefereed, predicted ok=${ok}`,
        ).toBe(ok);
      }
    }
  });

  it("reports the thresholds both ways round", () => {
    // 8 teams on 3 courts is the case that bites: it looks like a free
    // speed-up and needs a 9th team.
    expect(refereeCoverage(8, 3).ok).toBe(false);
    expect(refereeCoverage(8, 3).minTeams).toBe(9);
    expect(refereeCoverage(8, 2).ok).toBe(true);
    expect(refereeCoverage(8, 2).maxCourts).toBe(2);
    expect(refereeCoverage(10, 3).ok).toBe(true);
    expect(refereeCoverage(12, 4).ok).toBe(true);
    expect(refereeCoverage(10, 4).ok).toBe(false);
  });

  it("a group of 3 can't fill a third court, so it isn't warned about", () => {
    // A first cut used a flat numTeams >= 3 * numCourts, which cried wolf
    // here: groups of 3 manage one match each per slot, so a third court
    // stays empty and the two resting teams cover both matches.
    expect(maxConcurrentMatches(6, 3)).toBe(2);
    expect(refereeCoverage(6, 3).ok).toBe(true);
    expect(refereeCoverage(6, 9).ok).toBe(true);
    // Groups of 4 genuinely can run three at once, hence the shortfall.
    expect(maxConcurrentMatches(8, 3)).toBe(3);
  });
});

describe("grouping strategy vs team count", () => {
  const ALL: GroupingStrategy[] = [
    "zodiac_together",
    "zodiac_mixed",
    "mbti_together",
    "mbti_mixed",
  ];

  it("只有 *_together 被綁在 8 隊", () => {
    for (const n of teamCountOptions()) {
      expect(teamCountSupported("zodiac_together", n)).toBe(n === 8);
      expect(teamCountSupported("mbti_together", n)).toBe(n === 8);
      expect(teamCountSupported("zodiac_mixed", n)).toBe(true);
      expect(teamCountSupported("mbti_mixed", n)).toBe(true);
    }
  });

  it("the fallback a resize picks always supports that size", () => {
    // The settings screen switches strategy automatically when a resize rules
    // the current one out. If a counterpart could itself be unsupported the
    // switch would just move the failure, so this is the invariant that makes
    // the auto-switch safe rather than merely convenient.
    for (const strategy of ALL) {
      for (const n of teamCountOptions()) {
        expect(
          teamCountSupported(MIXED_COUNTERPART[strategy], n),
          `${strategy} → ${MIXED_COUNTERPART[strategy]} at ${n} teams`,
        ).toBe(true);
      }
    }
  });

  it("the fallback keeps the attribute and is a no-op for mixed", () => {
    // Switching 同星座象 → 打散各星座象 keeps grouping by zodiac and only
    // changes whether teammates share an element; jumping to MBTI would
    // silently discard what the admin actually chose.
    expect(MIXED_COUNTERPART.zodiac_together).toBe("zodiac_mixed");
    expect(MIXED_COUNTERPART.mbti_together).toBe("mbti_mixed");
    expect(MIXED_COUNTERPART.zodiac_mixed).toBe("zodiac_mixed");
    expect(MIXED_COUNTERPART.mbti_mixed).toBe("mbti_mixed");
  });

  it("FIXED_EIGHT_STRATEGIES and teamCountSupported agree", () => {
    for (const strategy of ALL) {
      expect(teamCountSupported(strategy, 6)).toBe(
        !FIXED_EIGHT_STRATEGIES.includes(strategy),
      );
    }
  });
});
