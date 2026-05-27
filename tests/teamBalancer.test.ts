import { describe, it, expect } from "vitest";
import {
  Player,
  assignByElement,
  balanceElementSizes,
  splitIntoSubteams,
  buildEightTeams,
} from "../lib/teamBalancer";

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
  };
}

describe("assignByElement", () => {
  it("buckets players into 4 elements", () => {
    const players: Player[] = [
      makePlayer("1", "1990-04-01"), // aries -> fire
      makePlayer("2", "1990-05-15"), // taurus -> earth
      makePlayer("3", "1990-06-15"), // gemini -> air
      makePlayer("4", "1990-07-01"), // cancer -> water
      makePlayer("5", "1990-08-01"), // leo -> fire
    ];
    const teams = assignByElement(players);
    const fire = teams.find((t) => t.element === "fire")!;
    expect(fire.members).toHaveLength(2);
    expect(teams.every((t) => t.label.length > 0)).toBe(true);
  });
});

describe("balanceElementSizes", () => {
  it("rebalances when one element is overloaded", () => {
    // 12 fire players, 4 each in other elements -> 24 total, avg = 6
    const players: Player[] = [];
    for (let i = 0; i < 12; i++) players.push(makePlayer(`f${i}`, "1990-08-01"));
    for (let i = 0; i < 4; i++) players.push(makePlayer(`e${i}`, "1990-05-15"));
    for (let i = 0; i < 4; i++) players.push(makePlayer(`a${i}`, "1990-06-15"));
    for (let i = 0; i < 4; i++) players.push(makePlayer(`w${i}`, "1990-07-01"));
    const initial = assignByElement(players);
    const balanced = balanceElementSizes(initial);
    const sizes = balanced.map((t) => t.members.length);
    const max = Math.max(...sizes);
    const min = Math.min(...sizes);
    expect(max - min).toBeLessThanOrEqual(2);
  });

  it("does nothing if already balanced", () => {
    const players: Player[] = [
      ...Array.from({ length: 6 }, (_, i) =>
        makePlayer(`f${i}`, "1990-08-01"),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makePlayer(`e${i}`, "1990-05-15"),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makePlayer(`a${i}`, "1990-06-15"),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makePlayer(`w${i}`, "1990-07-01"),
      ),
    ];
    const initial = assignByElement(players);
    const balanced = balanceElementSizes(initial);
    expect(balanced.map((t) => t.members.length)).toEqual([6, 6, 6, 6]);
  });

  it("does not mutate input", () => {
    const players: Player[] = Array.from({ length: 10 }, (_, i) =>
      makePlayer(`f${i}`, "1990-08-01"),
    );
    const initial = assignByElement(players);
    const beforeFireCount = initial.find((t) => t.element === "fire")!.members
      .length;
    balanceElementSizes(initial);
    expect(initial.find((t) => t.element === "fire")!.members.length).toBe(
      beforeFireCount,
    );
  });
});

describe("splitIntoSubteams", () => {
  it("splits roughly evenly with skill balance via snake draft", () => {
    const members: Player[] = Array.from({ length: 8 }, (_, i) =>
      makePlayer(String(i), "1990-08-01", { skill: i + 1 }),
    );
    const [a, b] = splitIntoSubteams({
      element: "fire",
      label: "fire",
      members,
    });
    expect(Math.abs(a.members.length - b.members.length)).toBeLessThanOrEqual(
      1,
    );
    const skillA = a.members.reduce((s, p) => s + p.skill, 0);
    const skillB = b.members.reduce((s, p) => s + p.skill, 0);
    expect(Math.abs(skillA - skillB)).toBeLessThanOrEqual(2);
  });

  it("labels sub-teams A and B", () => {
    const members = [makePlayer("1", "1990-08-01")];
    const [a, b] = splitIntoSubteams({
      element: "fire",
      label: "fire",
      members,
    });
    expect(a.subLabel).toBe("A");
    expect(b.subLabel).toBe("B");
  });
});

describe("buildEightTeams", () => {
  it("produces 8 sub-teams from a realistic 24-player roster", () => {
    const players: Player[] = [];
    // mix of elements, skills, genders, positions
    const dates = [
      "1990-08-01", // fire
      "1990-05-15", // earth
      "1990-06-15", // air
      "1990-07-01", // water
    ];
    const positions: Player["position"][] = [
      "setter",
      "outside",
      "middle",
      "opposite",
      "libero",
      "any",
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
    const teams = buildEightTeams(players);
    expect(teams).toHaveLength(8);
    const total = teams.reduce((s, t) => s + t.members.length, 0);
    expect(total).toBe(24);
    // every player appears exactly once
    const ids = teams.flatMap((t) => t.members.map((m) => m.id));
    expect(new Set(ids).size).toBe(24);
  });
});
