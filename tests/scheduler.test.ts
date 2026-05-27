import { describe, it, expect } from "vitest";
import {
  roundRobinPairs,
  scheduleGroupStage,
  buildFullSchedule,
  fillKnockoutTeams,
  SchedulerInput,
} from "../lib/scheduler";

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

  it("throws if a group does not have 4 teams", () => {
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
});
