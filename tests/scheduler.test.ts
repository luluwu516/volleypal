import { describe, it, expect } from "vitest";
import {
  roundRobinPairs,
  scheduleGroupStage,
  buildFullSchedule,
  fillKnockoutTeams,
  SchedulerInput,
} from "../lib/scheduler";
import { tournamentShape } from "../lib/tournamentFormat";

function makeInput(numCourts: number): SchedulerInput {
  return {
    teams: [
      ...["a1", "a2", "a3", "a4"].map((id) => ({
        id,
        groupLabel: "A" as const,
      })),
      ...["b1", "b2", "b3", "b4"].map((id) => ({
        id,
        groupLabel: "B" as const,
      })),
    ],
    shape: tournamentShape({ numTeams: 8, groupRounds: 1 }),
    numCourts,
    matchDurationMin: 30,
    startsAt: new Date("2026-06-01T09:00:00-07:00"),
  };
}

/** Six teams, two groups of three — the emergency downsize. */
function makeSixInput(
  numCourts: number,
  overrides: Partial<Parameters<typeof tournamentShape>[0]> = {},
): SchedulerInput {
  return {
    teams: [
      ...["a1", "a2", "a3"].map((id) => ({ id, groupLabel: "A" as const })),
      ...["b1", "b2", "b3"].map((id) => ({ id, groupLabel: "B" as const })),
    ],
    shape: tournamentShape({ numTeams: 6, groupRounds: 1, ...overrides }),
    numCourts,
    matchDurationMin: 30,
    startsAt: new Date("2026-06-01T09:00:00-07:00"),
  };
}

describe("roundRobinPairs", () => {
  it("produces n*(n-1)/2 pairs", () => {
    expect(roundRobinPairs(["a", "b", "c", "d"])).toHaveLength(6);
  });
  it("never pairs a team with itself", () => {
    const pairs = roundRobinPairs(["a", "b", "c", "d"]);
    pairs.forEach(([a, b]) => expect(a).not.toBe(b));
  });
});

describe("referee assignment (2 courts)", () => {
  it("assigns a referee to every group match", () => {
    const matches = scheduleGroupStage(makeInput(2));
    expect(matches.length).toBe(12);
    matches.forEach((m) => {
      expect(m.refereeTeamId).toBeTruthy();
    });
  });

  it("never assigns a playing team as the referee of its own slot", () => {
    const matches = scheduleGroupStage(makeInput(2));
    const bySlot = new Map<string, typeof matches>();
    for (const m of matches) {
      const k = m.scheduledAt.toISOString();
      bySlot.set(k, [...(bySlot.get(k) ?? []), m]);
    }
    for (const slotMatches of bySlot.values()) {
      const playing = new Set<string>();
      slotMatches.forEach((m) => {
        if (m.teamAId) playing.add(m.teamAId);
        if (m.teamBId) playing.add(m.teamBId);
      });
      slotMatches.forEach((m) => {
        expect(playing.has(m.refereeTeamId!)).toBe(false);
      });
    }
  });

  it("never assigns two matches in the same slot to the same referee", () => {
    const matches = scheduleGroupStage(makeInput(2));
    const bySlot = new Map<string, typeof matches>();
    for (const m of matches) {
      const k = m.scheduledAt.toISOString();
      bySlot.set(k, [...(bySlot.get(k) ?? []), m]);
    }
    for (const slotMatches of bySlot.values()) {
      const refs = slotMatches.map((m) => m.refereeTeamId);
      expect(new Set(refs).size).toBe(refs.length);
    }
  });

  it("spreads referee load evenly across teams (max−min ≤ 1)", () => {
    const matches = scheduleGroupStage(makeInput(2));
    const counts = new Map<string, number>();
    for (const m of matches) {
      if (!m.refereeTeamId) continue;
      counts.set(m.refereeTeamId, (counts.get(m.refereeTeamId) ?? 0) + 1);
    }
    const values = [...counts.values()];
    // 12 refereed matches / 8 teams should give 1-2 each, never 3.
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("rotates referees — avoids same team back-to-back when possible", () => {
    const matches = scheduleGroupStage(makeInput(2));
    const slots = [
      ...new Set(matches.map((m) => m.scheduledAt.toISOString())),
    ].sort();
    let prevRefs = new Set<string>();
    let consecutive = 0;
    for (const slot of slots) {
      const slotRefs = new Set(
        matches
          .filter((m) => m.scheduledAt.toISOString() === slot)
          .map((m) => m.refereeTeamId as string),
      );
      for (const r of slotRefs) if (prevRefs.has(r)) consecutive++;
      prevRefs = slotRefs;
    }
    // In a 12-match / 2-court schedule (6 slots, 2 refs/slot = 12 ref
    // assignments) with 8 teams, the rotation should comfortably keep
    // consecutive-ref reuse low.
    expect(consecutive).toBeLessThanOrEqual(2);
  });
});

describe("scheduleGroupStage", () => {
  it("produces 12 matches total (6 per group)", () => {
    const matches = scheduleGroupStage(makeInput(2));
    expect(matches).toHaveLength(12);
    expect(matches.filter((m) => m.groupLabel === "A")).toHaveLength(6);
    expect(matches.filter((m) => m.groupLabel === "B")).toHaveLength(6);
  });

  it.each([1, 2, 3, 4])("works with %i courts", (n) => {
    const matches = scheduleGroupStage(makeInput(n));
    expect(matches).toHaveLength(12);
    // No team plays two matches at the same time
    const bySlot: Record<string, Set<string>> = {};
    for (const m of matches) {
      const key = m.scheduledAt.toISOString();
      bySlot[key] ??= new Set();
      expect(bySlot[key].has(m.teamAId!)).toBe(false);
      expect(bySlot[key].has(m.teamBId!)).toBe(false);
      bySlot[key].add(m.teamAId!);
      bySlot[key].add(m.teamBId!);
    }
  });

  it("court numbers stay within numCourts", () => {
    const matches = scheduleGroupStage(makeInput(3));
    matches.forEach((m) => {
      expect(m.court).toBeGreaterThanOrEqual(1);
      expect(m.court).toBeLessThanOrEqual(3);
    });
  });

  it("throws if a group does not have the format's group size", () => {
    const bad: SchedulerInput = {
      ...makeInput(2),
      teams: [{ id: "a1", groupLabel: "A" }],
    };
    expect(() => scheduleGroupStage(bad)).toThrow();
  });
});

describe("buildFullSchedule + fillKnockoutTeams", () => {
  it("produces group + 8 knockout matches (Gold + Silver brackets)", () => {
    const { groupMatches, knockoutMatches } = buildFullSchedule(makeInput(2));
    expect(groupMatches).toHaveLength(12);
    expect(knockoutMatches).toHaveLength(8);
    expect(knockoutMatches.filter((m) => m.phase === "semifinal")).toHaveLength(
      2,
    );
    expect(
      knockoutMatches.filter((m) => m.phase === "silver_semifinal"),
    ).toHaveLength(2);
    expect(knockoutMatches.find((m) => m.phase === "final")).toBeDefined();
    expect(
      knockoutMatches.find((m) => m.phase === "third_place"),
    ).toBeDefined();
    expect(
      knockoutMatches.find((m) => m.phase === "silver_final"),
    ).toBeDefined();
    expect(
      knockoutMatches.find((m) => m.phase === "silver_third_place"),
    ).toBeDefined();
  });

  it("fills Gold + Silver semifinal teams from standings", () => {
    const { knockoutMatches } = buildFullSchedule(makeInput(2));
    const filled = fillKnockoutTeams(
      knockoutMatches,
      ["a1", "a2", "a3", "a4"],
      ["b1", "b2", "b3", "b4"],
    );
    const gold1 = filled.find(
      (m) => m.phase === "semifinal" && m.teamASource === "A 組 #1",
    )!;
    expect(gold1.teamAId).toBe("a1");
    expect(gold1.teamBId).toBe("b2");
    const gold2 = filled.find(
      (m) => m.phase === "semifinal" && m.teamASource === "B 組 #1",
    )!;
    expect(gold2.teamAId).toBe("b1");
    expect(gold2.teamBId).toBe("a2");

    const silver1 = filled.find(
      (m) => m.phase === "silver_semifinal" && m.teamASource === "A 組 #3",
    )!;
    expect(silver1.teamAId).toBe("a3");
    expect(silver1.teamBId).toBe("b4");
    const silver2 = filled.find(
      (m) => m.phase === "silver_semifinal" && m.teamASource === "B 組 #3",
    )!;
    expect(silver2.teamAId).toBe("b3");
    expect(silver2.teamBId).toBe("a4");
  });

  it("knockout starts after last group match", () => {
    const { groupMatches, knockoutMatches } = buildFullSchedule(makeInput(2));
    const lastGroup = Math.max(
      ...groupMatches.map((m) => m.scheduledAt.getTime()),
    );
    const firstKnockout = Math.min(
      ...knockoutMatches.map((m) => m.scheduledAt.getTime()),
    );
    expect(firstKnockout).toBeGreaterThan(lastGroup);
  });

  it("schedules all finals strictly after all semis", () => {
    const { knockoutMatches } = buildFullSchedule(makeInput(4));
    const semiTimes = knockoutMatches
      .filter(
        (m) => m.phase === "semifinal" || m.phase === "silver_semifinal",
      )
      .map((m) => m.scheduledAt.getTime());
    const finalTimes = knockoutMatches
      .filter(
        (m) =>
          m.phase === "final" ||
          m.phase === "silver_final" ||
          m.phase === "third_place" ||
          m.phase === "silver_third_place",
      )
      .map((m) => m.scheduledAt.getTime());
    expect(Math.min(...finalTimes)).toBeGreaterThan(Math.max(...semiTimes));
  });

  it("skipThirdPlace omits the Gold placement match only", () => {
    const { knockoutMatches } = buildFullSchedule({
      ...makeInput(2),
      shape: tournamentShape({ numTeams: 8, groupRounds: 1, skipThirdPlace: true }),
    });
    const phases = knockoutMatches.map((m) => m.phase).sort();
    expect(phases).not.toContain("third_place");
    // silver placement still present
    expect(phases).toContain("silver_third_place");
    // final + silver_final untouched
    expect(phases).toContain("final");
    expect(phases).toContain("silver_final");
  });

  it("skipSilverThirdPlace omits the Silver 7-8 match only", () => {
    const { knockoutMatches } = buildFullSchedule({
      ...makeInput(2),
      shape: tournamentShape({
        numTeams: 8,
        groupRounds: 1,
        skipSilverThirdPlace: true,
      }),
    });
    const phases = knockoutMatches.map((m) => m.phase);
    expect(phases).not.toContain("silver_third_place");
    expect(phases).toContain("third_place");
  });

  it("both skip flags → 6 knockout matches (2 semis + 2 semis + 2 finals)", () => {
    const { knockoutMatches } = buildFullSchedule({
      ...makeInput(2),
      shape: tournamentShape({
        numTeams: 8,
        groupRounds: 1,
        skipThirdPlace: true,
        skipSilverThirdPlace: true,
      }),
    });
    expect(knockoutMatches).toHaveLength(6);
  });
});

describe("tournament shapes", () => {
  it("不打銀盃 drops the whole lower bracket, keeps Gold intact", () => {
    const { groupMatches, knockoutMatches } = buildFullSchedule({
      ...makeInput(2),
      shape: tournamentShape({
        numTeams: 8,
        groupRounds: 1,
        skipSilverBracket: true,
      }),
    });
    expect(groupMatches).toHaveLength(12);
    // 2 semis + final + 3rd. Nothing silver at all — 5-8 stands on group
    // record, which is what the standings table already shows.
    expect(knockoutMatches).toHaveLength(4);
    expect(
      knockoutMatches.filter((m) => m.phase.startsWith("silver")),
    ).toHaveLength(0);
    expect(knockoutMatches.find((m) => m.phase === "final")).toBeDefined();
    expect(knockoutMatches.find((m) => m.phase === "third_place")).toBeDefined();
  });

  it("6 teams: 6 group matches and a 5-6 game instead of silver semis", () => {
    const { groupMatches, knockoutMatches } = buildFullSchedule(
      makeSixInput(2),
    );
    expect(groupMatches).toHaveLength(6);
    expect(groupMatches.filter((m) => m.groupLabel === "A")).toHaveLength(3);
    expect(groupMatches.filter((m) => m.groupLabel === "B")).toHaveLength(3);
    // 2 gold semis + final + 3rd + one 5-6 match.
    expect(knockoutMatches).toHaveLength(5);
    expect(
      knockoutMatches.filter((m) => m.phase === "silver_semifinal"),
    ).toHaveLength(0);
    expect(
      knockoutMatches.filter((m) => m.phase === "silver_third_place"),
    ).toHaveLength(0);
    const fiveSix = knockoutMatches.find((m) => m.phase === "silver_final");
    expect(fiveSix).toBeDefined();
    expect(fiveSix!.teamASource).toBe("A 組 #3");
    expect(fiveSix!.teamBSource).toBe("B 組 #3");
  });

  it("the 6-team 5-6 game is scheduled in the first knockout wave", () => {
    // It depends only on the group standings, so it must not be made to wait
    // for the gold semis — that would idle a court and push the finals back.
    const { knockoutMatches } = makeSixSchedule();
    const semiTime = Math.min(
      ...knockoutMatches
        .filter((m) => m.phase === "semifinal")
        .map((m) => m.scheduledAt.getTime()),
    );
    const finalTime = knockoutMatches.find(
      (m) => m.phase === "final",
    )!.scheduledAt.getTime();
    const fiveSixTime = knockoutMatches.find(
      (m) => m.phase === "silver_final",
    )!.scheduledAt.getTime();
    expect(fiveSixTime).toBeLessThan(finalTime);
    expect(fiveSixTime).toBeGreaterThanOrEqual(semiTime);
  });

  it("fills the 6-team 5-6 game straight from the group standings", () => {
    const { knockoutMatches } = makeSixSchedule();
    const filled = fillKnockoutTeams(
      knockoutMatches,
      ["a1", "a2", "a3"],
      ["b1", "b2", "b3"],
    );
    const fiveSix = filled.find((m) => m.phase === "silver_final")!;
    expect(fiveSix.teamAId).toBe("a3");
    expect(fiveSix.teamBId).toBe("b3");
    // Gold still crosses over the same way it does with 8 teams.
    const semi1 = filled.find((m) => m.teamASource === "A 組 #1")!;
    expect(semi1.teamAId).toBe("a1");
    expect(semi1.teamBId).toBe("b2");
  });

  it("skipSilverThirdPlace removes the 6-team 5-6 game", () => {
    const { knockoutMatches } = buildFullSchedule({
      ...makeSixInput(2, { skipSilverThirdPlace: true }),
    });
    expect(
      knockoutMatches.filter((m) => m.phase === "silver_final"),
    ).toHaveLength(0);
    expect(knockoutMatches).toHaveLength(4);
  });

  it("double round-robin plays each group twice without repeating orientation", () => {
    const { groupMatches } = buildFullSchedule(
      makeSixInput(2, { groupRounds: 2 }),
    );
    expect(groupMatches).toHaveLength(12);
    const a = groupMatches.filter((m) => m.groupLabel === "A");
    expect(a).toHaveLength(6);
    // Every unordered pair appears twice, and never twice the same way round.
    const ordered = a.map((m) => `${m.teamAId}v${m.teamBId}`);
    expect(new Set(ordered).size).toBe(6);
    const unordered = a.map((m) =>
      [m.teamAId, m.teamBId].sort().join("|"),
    );
    for (const pair of new Set(unordered)) {
      expect(unordered.filter((p) => p === pair)).toHaveLength(2);
    }
  });

  it("every team in a 6-team format plays every other in its group", () => {
    const { groupMatches } = buildFullSchedule(makeSixInput(2));
    const played = new Set(
      groupMatches.map((m) => [m.teamAId, m.teamBId].sort().join("|")),
    );
    expect(played).toContain("a1|a2");
    expect(played).toContain("a1|a3");
    expect(played).toContain("a2|a3");
    expect(played).toContain("b1|b2");
    expect(played).toContain("b1|b3");
    expect(played).toContain("b2|b3");
    expect(played.size).toBe(6);
  });
});

function makeSixSchedule() {
  return buildFullSchedule(makeSixInput(2));
}
