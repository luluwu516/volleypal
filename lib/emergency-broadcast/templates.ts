// Shared template metadata for the player-side emergency broadcast feature.
// Both the client picker UI and the server message composer read from here so
// the wire format stays synchronised — client sends keys, server renders the
// human-readable label into the announcement body.

export type IssueKey = "equipment" | "injury";
export type LocationKey =
  | `court_${number}`
  | "sideline"
  | "entrance"
  | "other";

// Kept ASCII/short so the switch/render code is stable if someone tweaks
// user-facing wording.
export const ISSUE_LABEL: Record<IssueKey, string> = {
  equipment: "缺少比賽器材",
  injury: "有人受傷 需要急救用品",
};

// Item pickers are gated by the issue: showing "冰塊" under 缺少比賽器材
// wouldn't make sense. Keys are unique within an issue but can repeat across
// (e.g. "other" appears in both — server always disambiguates by issue_key).
export const EQUIPMENT_ITEM_LABEL: Record<string, string> = {
  whistle: "哨子",
  scoreboard: "計分板",
  scoresheet: "記錄單",
  pen: "筆",
  other: "其他",
};
export const INJURY_ITEM_LABEL: Record<string, string> = {
  white_tape: "白貼",
  k_tape: "肌貼",
  first_aid: "急救用品",
  ice: "冰塊",
  other: "其他",
};

export const EQUIPMENT_ITEM_KEYS = Object.keys(EQUIPMENT_ITEM_LABEL);
export const INJURY_ITEM_KEYS = Object.keys(INJURY_ITEM_LABEL);

export function itemLabelFor(issue: IssueKey): Record<string, string> {
  return issue === "equipment" ? EQUIPMENT_ITEM_LABEL : INJURY_ITEM_LABEL;
}

// Location: court_1..court_N + fixed keys. Court count is looked up per
// tournament so we validate at the server against the live num_courts.
export function isValidLocationKey(
  key: string,
  numCourts: number,
): boolean {
  if (key === "sideline" || key === "entrance" || key === "other") return true;
  const m = key.match(/^court_(\d+)$/);
  if (!m) return false;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 && n <= numCourts;
}

export function locationLabel(
  key: string,
  otherText?: string | null,
): string {
  if (key === "sideline") return "場邊";
  if (key === "entrance") return "入口處";
  if (key === "other") {
    const trimmed = otherText?.trim() || "";
    return trimmed ? `其他: ${trimmed}` : "其他";
  }
  const m = key.match(/^court_(\d+)$/);
  if (m) return `場地${m[1]}`;
  return key;
}

// Body composition — single source of truth for the message format so the
// admin history view and the live banner render identically.
export function composeBody(input: {
  issue: IssueKey;
  location_key: string;
  location_other?: string | null;
  item_keys: string[];
  item_other?: string | null;
}): string {
  const labels = itemLabelFor(input.issue);
  const items = input.item_keys.map((k) => {
    if (k === "other") {
      const trimmed = input.item_other?.trim() || "";
      return trimmed ? `其他: ${trimmed}` : "其他";
    }
    return labels[k] ?? k;
  });
  const loc = locationLabel(input.location_key, input.location_other);
  const itemStr = items.length > 0 ? ` · 需要 ${items.join("、")}` : "";
  return `🆘 球員廣播: ${ISSUE_LABEL[input.issue]}${itemStr} · 地點 ${loc}`;
}
