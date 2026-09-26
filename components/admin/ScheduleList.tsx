import type { Match, Team } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { fmtTime } from "@/lib/formatTime";
import { RefereePicker } from "@/components/admin/RefereePicker";
import { CancelMatchButton } from "@/components/admin/CancelMatchButton";
import { RestoreMatchButton } from "@/components/admin/RestoreMatchButton";

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
  editable = false,
  disabled = false,
}: {
  matches: Match[];
  teams: Team[];
  editable?: boolean;
  disabled?: boolean;
}) {
  if (matches.length === 0) {
    return (
      <EmptyState
        glyph="📅"
        title="尚未生成賽程"
        body={
          editable
            ? "填好上方的場地數、每場長度、起始時間,按下「生成賽程」就會自動排出小組賽 + 淘汰賽。"
            : "主辦還沒排定賽程,排好後這裡就會顯示每個場地的對戰時間。"
        }
      />
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
  const canceledCount = matches.filter((m) => m.status === "canceled").length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        共 {matches.length} 場
        {canceledCount > 0 && (
          <span className="text-red-300/80">
            {" "}
            · {canceledCount} 場已取消
          </span>
        )}
      </p>
      {slots.map(([slotKey, slotMatches]) => (
        <div key={slotKey}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
            {slotKey === "tbd" ? "—" : fmtTime(slotKey)}
          </p>
          <div className="rounded-lg border divide-y divide-border/50">
            {slotMatches
              .sort((a, b) => (a.court ?? 0) - (b.court ?? 0))
              .map((m) => {
                const isCanceled = m.status === "canceled";
                return (
                <div
                  key={m.id}
                  className={`p-2.5 flex flex-col gap-1 ${
                    isCanceled ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground tabular-nums w-12 shrink-0">
                        C{m.court ?? "?"}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {PHASE_LABEL[m.phase] ?? m.phase}
                        {m.group_label ? ` ${m.group_label}` : ""}
                      </Badge>
                    </div>
                    {isCanceled ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 border-red-500/50 text-red-300 bg-red-500/10"
                      >
                        已取消
                      </Badge>
                    ) : (
                      m.status !== "pending" && (
                        <Badge
                          variant={
                            m.status === "live" ? "destructive" : "secondary"
                          }
                          className="text-[10px] shrink-0"
                        >
                          {m.status}
                        </Badge>
                      )
                    )}
                    {editable && m.status === "pending" && (
                      <CancelMatchButton
                        matchId={m.id}
                        label={`${PHASE_LABEL[m.phase] ?? m.phase}${
                          m.group_label ? ` ${m.group_label}` : ""
                        }`}
                        disabled={disabled}
                      />
                    )}
                    {editable && isCanceled && (
                      <RestoreMatchButton
                        matchId={m.id}
                        label={`${PHASE_LABEL[m.phase] ?? m.phase}${
                          m.group_label ? ` ${m.group_label}` : ""
                        }`}
                        disabled={disabled}
                      />
                    )}
                  </div>
                  {/* Team names get their own line: names are admin- or
                      player-chosen on match day (up to 60 chars) and sharing
                      a line with the court / phase / status chrome left them
                      ~150px on a 375pt phone, i.e. truncated to nothing.
                      pl-14 (w-12 court column + gap-2) indents this and the
                      referee line to start under the phase badge. */}
                  <p
                    className={`text-sm break-words pl-14 ${
                      isCanceled ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {teamName(m.team_a_id, m.team_a_source, teams)}{" "}
                    <span className="text-muted-foreground">vs</span>{" "}
                    {teamName(m.team_b_id, m.team_b_source, teams)}
                  </p>
                  <div className="text-[11px] text-muted-foreground pl-14 flex items-center gap-2">
                    <span>裁判：</span>
                    {editable ? (
                      <RefereePicker
                        match={m}
                        slotMatches={slotMatches}
                        teams={teams}
                        disabled={disabled}
                      />
                    ) : (
                      <span>
                        🦓{" "}
                        {m.referee_team_id
                          ? teamName(m.referee_team_id, null, teams)
                          : "現場協調"}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
