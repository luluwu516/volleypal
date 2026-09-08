import type { Registration, Tournament } from "@/lib/db/types";

/**
 * At-a-glance counter row that sits between the publish-time picker and the
 * registration tabs. Two hard numbers admin needs to watch throughout signup:
 * total active vs the roster cap, and non-Taiwanese vs their sub-cap.
 *
 * Colors ramp: neutral → amber at ≥80% → red at cap. Feedback happens purely
 * through the color; text stays static so admin doesn't have to hunt for a
 * changing badge to see saturation.
 */
export function ActiveRosterHeader({
  tournament,
  registrations,
}: {
  tournament: Pick<Tournament, "max_active_participants" | "max_non_taiwanese">;
  registrations: Pick<Registration, "is_active" | "is_taiwanese">[];
}) {
  const active = registrations.filter((r) => r.is_active);
  const total = active.length;
  const nonTw = active.filter((r) => !r.is_taiwanese).length;

  const totalCap = tournament.max_active_participants;
  const nonTwCap = tournament.max_non_taiwanese;

  return (
    <section
      className="rounded-lg border px-3 py-2 flex items-center justify-between gap-3 text-sm"
      aria-label="球員列表計數"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          球員
        </span>
        <span className={`font-semibold tabular-nums ${capColor(total, totalCap)}`}>
          {total}/{totalCap}
        </span>
      </div>
      <span className="text-muted-foreground/40">·</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          非台灣
        </span>
        <span className={`font-semibold tabular-nums ${capColor(nonTw, nonTwCap)}`}>
          {nonTw}/{nonTwCap}
        </span>
      </div>
    </section>
  );
}

function capColor(current: number, cap: number): string {
  if (cap <= 0) return "text-muted-foreground";
  if (current >= cap) return "text-red-400";
  if (current / cap >= 0.8) return "text-amber-400";
  return "text-foreground";
}
