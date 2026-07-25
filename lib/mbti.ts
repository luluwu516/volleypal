export type MbtiType =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";

// Keirsey temperament — the standard 4-way partition of the 16 MBTI codes.
// Fits our 8-team layout cleanly: 4 buckets × 2 sub-teams = 8.
export type Temperament = "NF" | "NT" | "SJ" | "SP";

export const MBTI_TYPES: readonly MbtiType[] = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
] as const;

export const TEMPERAMENTS: readonly Temperament[] = ["NF", "NT", "SJ", "SP"];

export const MBTI_TO_TEMPERAMENT: Record<MbtiType, Temperament> = {
  INFJ: "NF", INFP: "NF", ENFJ: "NF", ENFP: "NF",
  INTJ: "NT", INTP: "NT", ENTJ: "NT", ENTP: "NT",
  ISTJ: "SJ", ISFJ: "SJ", ESTJ: "SJ", ESFJ: "SJ",
  ISTP: "SP", ISFP: "SP", ESTP: "SP", ESFP: "SP",
};

export const TEMPERAMENT_LABELS_ZH: Record<Temperament, string> = {
  NF: "理想家",
  NT: "思想家",
  SJ: "守護家",
  SP: "藝術家",
};

export function isMbtiType(v: unknown): v is MbtiType {
  return typeof v === "string" && (MBTI_TYPES as readonly string[]).includes(v);
}

export function normalizeMbti(raw: string | null): MbtiType | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return isMbtiType(upper) ? upper : null;
}
