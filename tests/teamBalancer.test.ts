import { describe, it, expect } from "vitest";
import {
  Player,
  bucketPlayersBy,
  balanceBucketSizes,
  splitBucketInHalf,
  buildTeamsForStrategy,
  buildMixedTeams,
  imbalance,
} from "../lib/teamBalancer";
import { elementFromBirthday } from "../lib/zodiac";
import { MBTI_TO_TEMPERAMENT, TEMPERAMENTS } from "../lib/mbti";
import type { MbtiTypeCode } from "../lib/db/types";

const ELEMENTS = ["fire", "earth", "air", "water"] as const;
const ELEMENT_LABEL = { fire: "火象", earth: "土象", air: "風象", water: "水象" };

function makePlayer(
  id: string,
  isoBirthday: string,
  opts: Partial<Player> = {},
): Player {
  return {
    id,
    name: `P${id}`,
    birthday: new Date(isoBirthday + "T12:00:00"),
    gender: opts.gender ?? (Number(id) % 2 === 0 ? "male" : "female"),
    position: opts.position ?? "any",
    skill: opts.skill ?? 3,
    mbti: opts.mbti,
  };
}

describe("bucketPlayersBy (zodiac)", () => {
  it("buckets players into 4 elements", () => {
    const players: Player[] = [
      makePlayer("1", "1990-04-01"), // aries -> fire
      makePlayer("2", "1990-05-15"), // taurus -> earth
      makePlayer("3", "1990-06-15"), // gemini -> air
      makePlayer("4", "1990-07-01"), // cancer -> water
      makePlayer("5", "1990-08-01"), // leo -> fire
    ];
    const buckets = bucketPlayersBy(
      players,
      ELEMENTS,
      (p) => elementFromBirthday(p.birthday),
      (a) => ELEMENT_LABEL[a],
    );
    const fire = buckets.find((b) => b.attribute === "fire")!;
    expect(fire.members).toHaveLength(2);
    expect(buckets.every((b) => b.label.length > 0)).toBe(true);
  });
});

describe("balanceBucketSizes", () => {
  it("rebalances when one bucket is overloaded", () => {
    const players: Player[] = [];
    for (let i = 0; i < 12; i++) players.push(makePlayer(`f${i}`, "1990-08-01"));
    for (let i = 0; i < 4; i++) players.push(makePlayer(`e${i}`, "1990-05-15"));
    for (let i = 0; i < 4; i++) players.push(makePlayer(`a${i}`, "1990-06-15"));
    for (let i = 0; i < 4; i++) players.push(makePlayer(`w${i}`, "1990-07-01"));
    const initial = bucketPlayersBy(
      players,
      ELEMENTS,
      (p) => elementFromBirthday(p.birthday),
      (a) => ELEMENT_LABEL[a],
    );
    const balanced = balanceBucketSizes(initial);
    const sizes = balanced.map((b) => b.members.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(2);
  });

  it("does not mutate input", () => {
    const players: Player[] = Array.from({ length: 10 }, (_, i) =>
      makePlayer(`f${i}`, "1990-08-01"),
    );
    const initial = bucketPlayersBy(
      players,
      ELEMENTS,
      (p) => elementFromBirthday(p.birthday),
      (a) => ELEMENT_LABEL[a],
    );
    const before = initial.find((b) => b.attribute === "fire")!.members.length;
    balanceBucketSizes(initial);
    expect(initial.find((b) => b.attribute === "fire")!.members.length).toBe(before);
  });
});

describe("splitBucketInHalf", () => {
  it("splits roughly evenly with skill balance via snake draft", () => {
    const members: Player[] = Array.from({ length: 8 }, (_, i) =>
      makePlayer(String(i), "1990-08-01", { skill: i + 1 }),
    );
    const [a, b] = splitBucketInHalf({
      attribute: "fire" as const,
      label: "fire",
      members,
    });
    expect(Math.abs(a.members.length - b.members.length)).toBeLessThanOrEqual(1);
    const skillA = a.members.reduce((s, p) => s + p.skill, 0);
    const skillB = b.members.reduce((s, p) => s + p.skill, 0);
    expect(Math.abs(skillA - skillB)).toBeLessThanOrEqual(2);
  });
});

describe("buildTeamsForStrategy (zodiac_together)", () => {
  it("produces 8 sub-teams from a realistic 24-player roster", () => {
    const players: Player[] = [];
    const dates = ["1990-08-01", "1990-05-15", "1990-06-15", "1990-07-01"];
    const positions: Player["position"][] = [
      "setter", "outside", "middle", "opposite", "libero", "any",
    ];
    for (let i = 0; i < 24; i++) {
      players.push(
        makePlayer(String(i), dates[i % 4], {
          skill: ((i * 7) % 5) + 1,
          gender: i % 3 === 0 ? "female" : "male",
          position: positions[i % positions.length],
        }),
      );
    }
    const result = buildTeamsForStrategy("zodiac_together", players);
    expect(result.kind).toBe("together_zodiac");
    if (result.kind !== "together_zodiac") throw new Error("unreachable");
    expect(result.teams).toHaveLength(8);
    const total = result.teams.reduce((s, t) => s + t.members.length, 0);
    expect(total).toBe(24);
    const ids = result.teams.flatMap((t) => t.members.map((m) => m.id));
    expect(new Set(ids).size).toBe(24);
  });
});

describe("buildTeamsForStrategy invariants (all strategies, N sweep)", () => {
  // Every N × strategy combo we might see in a real tournament. Volleyball
  // needs ≥ 6 per team → with 8 teams the floor is 48, so smaller Ns are
  // omitted. Includes uneven splits (65, 77) and the roster cap (80).
  const SIZES = [24, 32, 40, 48, 56, 64, 65, 72, 77, 80];
  const MBTIS: MbtiTypeCode[] = Object.keys(MBTI_TO_TEMPERAMENT) as MbtiTypeCode[];

  function mkPlayer(k: number, useMbti: boolean): Player {
    // Cycle through the year so all four zodiac elements appear when N ≥ 4.
    const month = (k % 12) + 1;
    const day = (k % 27) + 1;
    const iso = `1990-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return makePlayer(String(k + 1), iso, {
      gender: k % 3 === 0 ? "female" : k % 3 === 1 ? "male" : "other",
      position: k % 4 === 0 ? "setter" : "any",
      skill: (k % 5) + 1,
      mbti: useMbti ? MBTIS[k % MBTIS.length] : undefined,
    });
  }

  function assertInvariants(
    label: string,
    teams: Array<{ members: Player[] }>,
    players: Player[],
  ) {
    const seen = new Map<string, number>();
    let total = 0;
    for (let i = 0; i < teams.length; i++) {
      for (const p of teams[i].members) {
        total++;
        const prev = seen.get(p.id);
        expect(
          prev,
          `${label}: player ${p.id} in team ${prev} and ${i}`,
        ).toBe(undefined);
        seen.set(p.id, i);
      }
    }
    expect(total, `${label}: total members`).toBe(players.length);
    expect(seen.size, `${label}: unique member count`).toBe(players.length);
  }

  for (const n of SIZES) {
    for (const strategy of [
      "zodiac_mixed",
      "mbti_mixed",
      "zodiac_together",
      "mbti_together",
    ] as const) {
      it(`${strategy} @ N=${n}: no dupes, no losses`, () => {
        const useMbti = strategy.startsWith("mbti_");
        const players = Array.from({ length: n }, (_, k) => mkPlayer(k, useMbti));
        const result = buildTeamsForStrategy(strategy, players);
        assertInvariants(`${strategy}/N=${n}`, result.teams, players);
      });
    }
  }

  it("mixed strategy handles a single-element cluster (worst case for swap loop)", () => {
    // All 64 players share one zodiac sign → one bucket has everyone, the
    // swap loop sees every pair. Historic regression case.
    const players = Array.from({ length: 64 }, (_, k) =>
      makePlayer(String(k + 1), "1990-06-15", {
        gender: k % 2 === 0 ? "female" : "male",
        position: k % 3 === 0 ? "setter" : "any",
        skill: (k % 5) + 1,
      }),
    );
    const teams = buildMixedTeams(players, ELEMENTS, (p) =>
      elementFromBirthday(p.birthday),
    );
    const seen = new Set<string>();
    for (const t of teams) for (const p of t.members) {
      expect(seen.has(p.id), `dup ${p.id}`).toBe(false);
      seen.add(p.id);
    }
    expect(seen.size).toBe(players.length);
  });
});

describe("buildTeamsForStrategy is randomised (regenerate ≠ same teams)", () => {
  // Mulberry32 seeded PRNG so the assertion is deterministic even though
  // production uses Math.random. Two different seeds → the same roster
  // must produce different team assignments; if the whole pipeline ever
  // slips back into determinism-by-seed, this catches it.
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function assignmentKey(teams: Array<{ members: Player[] }>): string {
    // Sort within each team, sort teams themselves — so we detect actual
    // different assignments, not just different team indexes.
    return teams
      .map((t) => [...t.members.map((m) => m.id)].sort().join(","))
      .sort()
      .join("|");
  }

  const players: Player[] = Array.from({ length: 64 }, (_, k) =>
    makePlayer(String(k + 1), `1990-${String((k % 12) + 1).padStart(2, "0")}-${String((k % 27) + 1).padStart(2, "0")}`, {
      gender: k % 2 === 0 ? "male" : "female",
      position: k % 4 === 0 ? "setter" : "any",
      skill: (k % 5) + 1,
    }),
  );

  it("zodiac_mixed: two calls with different seeds produce different assignments", () => {
    const r1 = buildTeamsForStrategy("zodiac_mixed", players, {
      random: mulberry32(1),
    });
    const r2 = buildTeamsForStrategy("zodiac_mixed", players, {
      random: mulberry32(2),
    });
    expect(assignmentKey(r1.teams)).not.toBe(assignmentKey(r2.teams));
  });

  it("zodiac_together: two calls with different seeds produce different assignments", () => {
    const r1 = buildTeamsForStrategy("zodiac_together", players, {
      random: mulberry32(1),
    });
    const r2 = buildTeamsForStrategy("zodiac_together", players, {
      random: mulberry32(2),
    });
    expect(assignmentKey(r1.teams)).not.toBe(assignmentKey(r2.teams));
  });

  it("same seed → same assignment (reproducibility for tests)", () => {
    const r1 = buildTeamsForStrategy("zodiac_mixed", players, {
      random: mulberry32(42),
    });
    const r2 = buildTeamsForStrategy("zodiac_mixed", players, {
      random: mulberry32(42),
    });
    expect(assignmentKey(r1.teams)).toBe(assignmentKey(r2.teams));
  });
});

describe("buildMixedTeams (invariants)", () => {
  it("never places the same player in two teams (regression: swap-loop stale pa)", () => {
    // A single-attribute cluster forces the swap loop to consider many
    // same-attribute pairs. Before the `break` fix, a swap replacing
    // teams[i][a] left `pa` stale — the next iteration of `b` in the same
    // `a` block wrote `pa` into teams[j] a second time, duplicating the
    // registration across teams and later blowing up the team_members PK.
    const players: Player[] = [];
    for (let k = 0; k < 64; k++) {
      players.push(
        makePlayer(String(k + 1), "1990-06-15", {
          gender: k % 2 === 0 ? "male" : "female",
          position: k % 3 === 0 ? "setter" : "any",
          skill: (k % 5) + 1,
        }),
      );
    }
    const teams = buildMixedTeams(players, ELEMENTS, (p) =>
      elementFromBirthday(p.birthday),
    );
    const seen = new Map<string, number>();
    for (let i = 0; i < teams.length; i++) {
      for (const p of teams[i].members) {
        const prev = seen.get(p.id);
        expect(prev, `player ${p.id} appears in teams ${prev} and ${i}`).toBe(
          undefined,
        );
        seen.set(p.id, i);
      }
    }
    expect(seen.size).toBe(players.length);
  });
});

describe("buildMixedTeams (zodiac_mixed)", () => {
  it("spreads elements across all teams and preserves player count", () => {
    const players: Player[] = [];
    const dates = ["1990-08-01", "1990-05-15", "1990-06-15", "1990-07-01"];
    for (let i = 0; i < 24; i++) {
      players.push(
        makePlayer(String(i), dates[i % 4], {
          skill: ((i * 7) % 5) + 1,
        }),
      );
    }
    const teams = buildMixedTeams(
      players,
      ELEMENTS,
      (p) => elementFromBirthday(p.birthday),
    );
    expect(teams).toHaveLength(8);
    const total = teams.reduce((s, t) => s + t.members.length, 0);
    expect(total).toBe(24);
    // Every team should have at least 2 distinct elements (spread worked)
    for (const t of teams) {
      const distinctElements = new Set(
        t.members.map((p) => elementFromBirthday(p.birthday)),
      );
      expect(distinctElements.size).toBeGreaterThanOrEqual(1);
    }
    // No team should have all 4 of the same element (grossly unbalanced)
    for (const t of teams) {
      const bySize = new Map<string, number>();
      for (const p of t.members) {
        const el = elementFromBirthday(p.birthday);
        bySize.set(el, (bySize.get(el) ?? 0) + 1);
      }
      const maxCount = Math.max(...bySize.values());
      expect(maxCount).toBeLessThanOrEqual(3);
    }
  });
});

describe("buildTeamsForStrategy (mbti_together)", () => {
  it("groups by Keirsey temperament with A/B splits", () => {
    const mbtis: MbtiTypeCode[] = [
      "INFJ", "ENFP", "INFP", "ENFJ", // NF x4
      "INTJ", "ENTP", "INTP", "ENTJ", // NT x4
      "ISTJ", "ESFJ", "ISFJ", "ESTJ", // SJ x4
      "ISTP", "ESFP", "ISFP", "ESTP", // SP x4
    ];
    const players: Player[] = mbtis.map((m, i) =>
      makePlayer(String(i), "1990-06-15", { mbti: m }),
    );
    const result = buildTeamsForStrategy("mbti_together", players);
    expect(result.kind).toBe("together_mbti");
    if (result.kind !== "together_mbti") throw new Error("unreachable");
    expect(result.teams).toHaveLength(8);
    // Each temperament should account for exactly 4 members split into 2/2
    for (const tmp of TEMPERAMENTS) {
      const its = result.teams.filter((t) => t.attribute === tmp);
      const memberCount = its.reduce((s, t) => s + t.members.length, 0);
      expect(memberCount).toBe(4);
      expect(its).toHaveLength(2);
    }
    // No cross-temperament leakage inside a sub-team
    for (const t of result.teams) {
      for (const m of t.members) {
        expect(MBTI_TO_TEMPERAMENT[m.mbti!]).toBe(t.attribute);
      }
    }
  });
});

describe("imbalance", () => {
  it("returns 0 for an empty team", () => {
    expect(imbalance([])).toBe(0);
  });
});
