import type { Match, Team } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { fmtTime } from "@/lib/formatTime";

function teamName(
  id: string | null,
  source: string | null,
  teams: Team[],
): string {
  if (id) return teams.find((t) => t.id === id)?.name ?? id.slice(0, 6);
  return source ?? "TBD";
}

const PHASE_LABEL: Record<string, string> = {
  group: "預賽",
  semifinal: "Gold 準決賽",
  final: "Gold 決賽",
  third_place: "Gold 季軍",
  silver_semifinal: "Silver 準決賽",
  silver_final: "Silver 決賽",
  silver_third_place: "Silver 7-8 名",
};

export function ScheduleList({
  matches,
  teams,
}: {
  matches: Match[];
  teams: Team[];
}) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        尚未生成賽程
      </p>
    );
  }

  // Group by scheduled_at (time slot) for readability
  const bySlot = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.scheduled_at ?? "tbd";
    const list = bySlot.get(key) ?? [];
    list.push(m);
    bySlot.set(key, list);
  }
  const slots = [...bySlot.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        共 {matches.length} 場
      </p>
      {slots.map(([slotKey, slotMatches]) => (
        <div key={slotKey}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
            {slotKey === "tbd" ? "—" : fmtTime(slotKey)}
          </p>
          <div className="rounded-lg border divide-y divide-border/50">
            {slotMatches
              .sort((a, b) => (a.court ?? 0) - (b.court ?? 0))
              .map((m) => (
                <div key={m.id} className="p-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground tabular-nums w-12 shrink-0">
                        C{m.court ?? "?"}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {PHASE_LABEL[m.phase] ?? m.phase}
                        {m.group_label ? ` ${m.group_label}` : ""}
                      </Badge>
                      <span className="text-sm truncate">
                        {teamName(m.team_a_id, m.team_a_source, teams)}{" "}
                        <span className="text-muted-foreground">vs</span>{" "}
                        {teamName(m.team_b_id, m.team_b_source, teams)}
                      </span>
                    </div>
                    {m.status !== "pending" && (
                      <Badge
                        variant={
                          m.status === "live" ? "destructive" : "secondary"
                        }
                        className="text-[10px] shrink-0"
                      >
                        {m.status}
                      </Badge>
                    )}
                  </div>
                  {m.referee_team_id && (
                    <div className="text-[11px] text-muted-foreground pl-14">
                      🦓 裁判：{teamName(m.referee_team_id, null, teams)}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
