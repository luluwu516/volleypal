import { Element, elementFromBirthday, ELEMENT_LABELS_ZH } from "./zodiac";

export type Position =
  | "setter"
  | "outside"
  | "middle"
  | "opposite"
  | "libero"
  | "any";

export type Gender = "male" | "female" | "other";

export interface Player {
  id: string;
  name: string;
  birthday: Date;
  gender?: Gender;
  position: Position;
  skill: number;
}

export interface ElementTeam {
  element: Element;
  label: string;
  members: Player[];
}

export interface SubTeam {
  element: Element;
  label: string;
  subLabel: "A" | "B";
  members: Player[];
}

const ELEMENTS: Element[] = ["fire", "earth", "air", "water"];

export function assignByElement(players: Player[]): ElementTeam[] {
  const buckets: Record<Element, Player[]> = {
    fire: [],
    earth: [],
    air: [],
    water: [],
  };
  for (const p of players) {
    buckets[elementFromBirthday(p.birthday)].push(p);
  }
  return ELEMENTS.map((element) => ({
    element,
    label: ELEMENT_LABELS_ZH[element],
    members: buckets[element],
  }));
}

interface BalanceOptions {
  /** A team is overloaded if its size > avg * (1 + tolerance). Default 0.15. */
  tolerance?: number;
  /** Hard cap on rebalance iterations (safety). */
  maxIterations?: number;
}

/**
 * Rebalance element teams when sizes are uneven. Moves the player from the
 * largest team into the smallest team whose move best preserves
 * gender / position / skill balance across both teams.
 *
 * The "element" identity of moved players is overridden by the new team.
 * Returns a NEW array; does not mutate input.
 */
export function balanceElementSizes(
  teams: ElementTeam[],
  options: BalanceOptions = {},
): ElementTeam[] {
  const tolerance = options.tolerance ?? 0.15;
  const maxIter = options.maxIterations ?? 200;

  const working = teams.map((t) => ({ ...t, members: [...t.members] }));
  const total = working.reduce((sum, t) => sum + t.members.length, 0);
  if (total === 0) return working;
  const avg = total / working.length;
  const overloadAt = Math.ceil(avg * (1 + tolerance));

  for (let i = 0; i < maxIter; i++) {
    const donor = [...working].sort(
      (a, b) => b.members.length - a.members.length,
    )[0];
    const recipient = [...working].sort(
      (a, b) => a.members.length - b.members.length,
    )[0];

    if (donor.members.length <= overloadAt) break;
    if (donor.members.length - recipient.members.length <= 1) break;

    let bestPlayer: Player | null = null;
    let bestCost = Infinity;
    for (const candidate of donor.members) {
      const donorWithout = donor.members.filter((m) => m.id !== candidate.id);
      const recipientWith = [...recipient.members, candidate];
      const cost =
        imbalance(donorWithout) +
        imbalance(recipientWith) +
        Math.abs(donorWithout.length - recipientWith.length) * 0.5;
      if (cost < bestCost) {
        bestCost = cost;
        bestPlayer = candidate;
      }
    }
    if (!bestPlayer) break;
    donor.members = donor.members.filter((m) => m.id !== bestPlayer!.id);
    recipient.members = [...recipient.members, bestPlayer];
  }

  return working;
}

/**
 * "Imbalance" of a single team = sum of squared deviations of gender ratio,
 * position distribution, and skill mean from team-internal expectations.
 * Lower is better. Used as a heuristic, not an exact metric.
 */
function imbalance(members: Player[]): number {
  if (members.length === 0) return 0;
  const genderCounts: Record<Gender | "unknown", number> = {
    male: 0,
    female: 0,
    other: 0,
    unknown: 0,
  };
  const positionCounts: Record<Position, number> = {
    setter: 0,
    outside: 0,
    middle: 0,
    opposite: 0,
    libero: 0,
    any: 0,
  };
  let skillSum = 0;
  for (const m of members) {
    genderCounts[m.gender ?? "unknown"]++;
    positionCounts[m.position]++;
    skillSum += m.skill;
  }
  const n = members.length;
  const skillMean = skillSum / n;
  const idealSkill = 3;
  const skillDev = (skillMean - idealSkill) ** 2;
  const genderRatio = genderCounts.male / n - 0.5;
  const genderDev = genderRatio ** 2;
  let positionDev = 0;
  const idealPositionShare = 1 / 6;
  for (const c of Object.values(positionCounts)) {
    positionDev += (c / n - idealPositionShare) ** 2;
  }
  return skillDev + genderDev + positionDev;
}

/**
 * Zigzag (snake) draft to split an element's members into balanced A/B teams.
 * Sort by skill desc; alternate A,B,B,A,A,B,B,A...
 */
export function splitIntoSubteams(team: ElementTeam): [SubTeam, SubTeam] {
  const sorted = [...team.members].sort((a, b) => b.skill - a.skill);
  const a: Player[] = [];
  const b: Player[] = [];
  sorted.forEach((p, i) => {
    // Snake: pairs (0,1) (3,2) (4,5) (7,6) ...
    const pair = Math.floor(i / 2);
    const inPair = i % 2;
    const goesA = pair % 2 === 0 ? inPair === 0 : inPair === 1;
    if (goesA) a.push(p);
    else b.push(p);
  });
  return [
    { element: team.element, label: team.label, subLabel: "A", members: a },
    { element: team.element, label: team.label, subLabel: "B", members: b },
  ];
}

/**
 * Full pipeline: players -> 4 balanced element teams -> 8 sub-teams (A/B per element).
 */
export function buildEightTeams(
  players: Player[],
  options?: BalanceOptions,
): SubTeam[] {
  const initial = assignByElement(players);
  const balanced = balanceElementSizes(initial, options);
  return balanced.flatMap((t) => splitIntoSubteams(t));
}
