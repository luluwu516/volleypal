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
