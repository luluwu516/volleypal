import type { Registration } from "@/lib/db/types";

// Legal `name` is the matching key (passport romanisation / Chinese full name);
// `preferred_name` is the day-to-day nickname admins and players actually
// recognise. All UIs go through this helper so we can tweak the fallback rule
// in one place — e.g. later blank-out preferred names for official podium /
// certificate export contexts.
export function displayName(
  r: Pick<Registration, "name" | "preferred_name">,
): string {
  const nick = r.preferred_name?.trim();
  return nick ? nick : r.name;
}

// True when there is a distinct nickname worth surfacing alongside the legal
// name in a details popover. Used by the admin roster to decide whether to
// print a separate "正式姓名" row.
export function hasDistinctPreferred(
  r: Pick<Registration, "name" | "preferred_name">,
): boolean {
  const nick = r.preferred_name?.trim();
  return Boolean(nick) && nick !== r.name;
}
