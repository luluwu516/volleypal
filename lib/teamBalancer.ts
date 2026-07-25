import { Element, elementFromBirthday, ELEMENT_LABELS_ZH } from "./zodiac";
import {
  type MbtiType,
  type Temperament,
  MBTI_TO_TEMPERAMENT,
  TEMPERAMENT_LABELS_ZH,
  TEMPERAMENTS,
} from "./mbti";
import type { GroupingStrategy } from "./db/types";

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
  mbti?: MbtiType;
}

const ELEMENTS: Element[] = ["fire", "earth", "air", "water"];

// -------- Generic attribute-based bucketing --------

export interface Bucket<A extends string> {
  attribute: A;
  label: string;
  members: Player[];
}

export interface SubBucket<A extends string> {
  attribute: A;
  label: string;
  subLabel: "A" | "B";
  members: Player[];
}

/**
 * Bucket players by an attribute extractor. Attributes list controls output
 * order; empty attributes produce empty buckets so downstream splitting still
 * emits 4 groups worth (needed for the together strategies).
 */
export function bucketPlayersBy<A extends string>(
  players: Player[],
  attributes: readonly A[],
  getAttribute: (p: Player) => A,
  labelFor: (a: A) => string,
): Bucket<A>[] {
  const map = new Map<A, Player[]>();
  for (const a of attributes) map.set(a, []);
  for (const p of players) {
    const key = getAttribute(p);
    const list = map.get(key);
    if (list) list.push(p);
  }
  return attributes.map((a) => ({
    attribute: a,
    label: labelFor(a),
    members: map.get(a) ?? [],
  }));
}

// -------- Balance / imbalance --------

interface BalanceOptions {
  /** A team is overloaded if its size > avg * (1 + tolerance). Default 0.15. */
  tolerance?: number;
  /** Hard cap on rebalance iterations (safety). */
  maxIterations?: number;
}

/**
 * Rebalance buckets when sizes are uneven. Moves the player from the
 * largest bucket into the smallest one whose move best preserves
 * gender / position / skill balance. Attribute identity of moved players is
 * effectively overridden by the destination bucket. Pure — returns new array.
 */
export function balanceBucketSizes<A extends string>(
  buckets: Bucket<A>[],
  options: BalanceOptions = {},
): Bucket<A>[] {
  const tolerance = options.tolerance ?? 0.15;
  const maxIter = options.maxIterations ?? 200;

  const working = buckets.map((b) => ({ ...b, members: [...b.members] }));
  const total = working.reduce((sum, b) => sum + b.members.length, 0);
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
export function imbalance(members: Player[]): number {
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
 * Zigzag (snake) draft to split a bucket's members into balanced A/B teams.
 * Sort by skill desc; alternate A,B,B,A,A,B,B,A...
 */
export function splitBucketInHalf<A extends string>(
  bucket: Bucket<A>,
): [SubBucket<A>, SubBucket<A>] {
  const sorted = [...bucket.members].sort((a, b) => b.skill - a.skill);
  const a: Player[] = [];
  const b: Player[] = [];
  sorted.forEach((p, i) => {
    const pair = Math.floor(i / 2);
    const inPair = i % 2;
    const goesA = pair % 2 === 0 ? inPair === 0 : inPair === 1;
    if (goesA) a.push(p);
    else b.push(p);
  });
  return [
    { attribute: bucket.attribute, label: bucket.label, subLabel: "A", members: a },
    { attribute: bucket.attribute, label: bucket.label, subLabel: "B", members: b },
  ];
}

/**
 * "Together" pipeline: bucket by attribute → balance sizes → snake-split each
 * bucket into A/B. Produces exactly 2 × attributes.length sub-teams.
 */
export function buildTogetherTeams<A extends string>(
  players: Player[],
  attributes: readonly A[],
  getAttribute: (p: Player) => A,
  labelFor: (a: A) => string,
  options?: BalanceOptions,
): SubBucket<A>[] {
  const initial = bucketPlayersBy(players, attributes, getAttribute, labelFor);
  const balanced = balanceBucketSizes(initial, options);
  return balanced.flatMap((b) => splitBucketInHalf(b));
}

// -------- Mixed strategy --------

export interface MixedTeam {
  name: string;
  members: Player[];
}

/**
 * "Mixed" pipeline: spread each attribute evenly across `teamCount` generic
 * teams. Within each attribute bucket, snake-draft (skill-descending) across
 * the teams so no team is starved. Then run a local-search swap pass to
 * shrink gender / position / skill imbalance without breaking attribute
 * spread — swaps only allowed between same-attribute pairs.
 */
export function buildMixedTeams<A extends string>(
  players: Player[],
  attributes: readonly A[],
  getAttribute: (p: Player) => A,
  teamCount = 8,
  options?: { maxSwapIterations?: number },
): MixedTeam[] {
  const teams: Player[][] = Array.from({ length: teamCount }, () => []);
  const buckets = bucketPlayersBy(players, attributes, getAttribute, () => "");

  // Greedy spread: for each player (skill-desc within attribute), pick the
  // team with the fewest of this attribute already; break ties by smallest
  // total team size. Guarantees no team is empty when players ≥ teamCount
  // and gives evenly-spread attributes even when count-per-attribute doesn't
  // divide teamCount evenly (e.g. 6 players / 8 teams).
  for (const bucket of buckets) {
    const sorted = [...bucket.members].sort((a, b) => b.skill - a.skill);
    for (const p of sorted) {
      let targetIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < teamCount; i++) {
        const attrCount = teams[i].filter(
          (x) => getAttribute(x) === bucket.attribute,
        ).length;
        const score = attrCount * teamCount + teams[i].length;
        if (score < bestScore) {
          bestScore = score;
          targetIdx = i;
        }
      }
      teams[targetIdx].push(p);
    }
  }

  // Swap-optimization: for each pair of same-attribute players in different
  // teams, swap if it reduces total imbalance. Repeat until no gains or cap.
  const maxIter = options?.maxSwapIterations ?? 40;
  for (let iter = 0; iter < maxIter; iter++) {
    let improved = false;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        for (let a = 0; a < teams[i].length; a++) {
          const pa = teams[i][a];
          const attrA = getAttribute(pa);
          for (let b = 0; b < teams[j].length; b++) {
            const pb = teams[j][b];
            if (getAttribute(pb) !== attrA) continue;
            const before = imbalance(teams[i]) + imbalance(teams[j]);
            const swappedI = [...teams[i]];
            swappedI[a] = pb;
            const swappedJ = [...teams[j]];
            swappedJ[b] = pa;
            const after = imbalance(swappedI) + imbalance(swappedJ);
            if (after + 1e-6 < before) {
              teams[i] = swappedI;
              teams[j] = swappedJ;
              improved = true;
            }
          }
        }
      }
    }
    if (!improved) break;
  }

  return teams.map((members, i) => ({
    name: `隊伍 ${i + 1}`,
    members,
  }));
}

// -------- Strategy orchestration --------

export type BuildResult =
  | { kind: "together_zodiac"; teams: SubBucket<Element>[] }
  | { kind: "together_mbti"; teams: SubBucket<Temperament>[] }
  | { kind: "mixed"; teams: MixedTeam[] };

export interface StrategyValidation {
  ok: boolean;
  missingBirthday?: Player[];
  missingMbti?: Player[];
}

export function validatePlayersFor(
  strategy: GroupingStrategy,
  players: Player[],
): StrategyValidation {
  if (strategy === "zodiac_together" || strategy === "zodiac_mixed") {
    const missingBirthday = players.filter((p) => !p.birthday || Number.isNaN(p.birthday.getTime()));
    if (missingBirthday.length > 0) {
      return { ok: false, missingBirthday };
    }
    return { ok: true };
  }
  const missingMbti = players.filter((p) => !p.mbti);
  if (missingMbti.length > 0) return { ok: false, missingMbti };
  return { ok: true };
}

export function buildTeamsForStrategy(
  strategy: GroupingStrategy,
  players: Player[],
  options?: BalanceOptions,
): BuildResult {
  switch (strategy) {
    case "zodiac_together": {
      const teams = buildTogetherTeams<Element>(
        players,
        ELEMENTS,
        (p) => elementFromBirthday(p.birthday),
        (a) => ELEMENT_LABELS_ZH[a],
        options,
      );
      return { kind: "together_zodiac", teams };
    }
    case "zodiac_mixed": {
      const teams = buildMixedTeams<Element>(
        players,
        ELEMENTS,
        (p) => elementFromBirthday(p.birthday),
      );
      return { kind: "mixed", teams };
    }
    case "mbti_together": {
      const teams = buildTogetherTeams<Temperament>(
        players,
        TEMPERAMENTS,
        (p) => MBTI_TO_TEMPERAMENT[p.mbti!],
        (a) => TEMPERAMENT_LABELS_ZH[a],
        options,
      );
      return { kind: "together_mbti", teams };
    }
    case "mbti_mixed": {
      const teams = buildMixedTeams<Temperament>(
        players,
        TEMPERAMENTS,
        (p) => MBTI_TO_TEMPERAMENT[p.mbti!],
      );
      return { kind: "mixed", teams };
    }
  }
}
