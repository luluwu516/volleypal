import type { Match, MatchSet, Team } from "@/lib/db/types";
import { fmtTime } from "@/lib/formatTime";

interface Props {
  matches: Match[];
  matchSets: MatchSet[];
  teams: Team[];
  /** Team IDs in this group, in the order to display. */
  groupTeamIds: string[];
}

interface CellResult {
  setsForRow: number;
  setsForCol: number;
  pending: boolean;
  finished: boolean;
  scheduledAt: string | null;
}

function findCell(
  matches: Match[],
  setsByMatch: Map<string, MatchSet[]>,
  rowTeamId: string,
  colTeamId: string,
): CellResult | null {
  const m = matches.find(
    (m) =>
      (m.team_a_id === rowTeamId && m.team_b_id === colTeamId) ||
      (m.team_a_id === colTeamId && m.team_b_id === rowTeamId),
  );
  if (!m) return null;
  const matchSets = setsByMatch.get(m.id) ?? [];
  let setsForA = 0;
  let setsForB = 0;
  for (const s of matchSets) {
    if (s.score_a > s.score_b) setsForA++;
    else if (s.score_b > s.score_a) setsForB++;
  }
  const rowIsA = m.team_a_id === rowTeamId;
  return {
    setsForRow: rowIsA ? setsForA : setsForB,
    setsForCol: rowIsA ? setsForB : setsForA,
    pending: m.status === "pending",
    finished: m.status === "finished",
    scheduledAt: m.scheduled_at,
  };
}

export function RoundRobinMatrix({
  matches,
  matchSets,
  teams,
  groupTeamIds,
}: Props) {
  if (groupTeamIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        尚未分組
      </p>
    );
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  // Build a per-match index of sets for O(1) lookup
  const setsByMatch = new Map<string, MatchSet[]>();
  for (const s of matchSets) {
    const list = setsByMatch.get(s.match_id) ?? [];
    list.push(s);
    setsByMatch.set(s.match_id, list);
  }

  const labels = groupTeamIds.map(
    (id) => teamById.get(id)?.name ?? id.slice(0, 4),
  );

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground uppercase">
          <tr>
            <th className="text-left px-2 py-2 font-normal w-[28%]"> </th>
            {labels.map((l, i) => (
              <th
                key={groupTeamIds[i]}
                className="text-center px-1 py-2 font-normal truncate"
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupTeamIds.map((rowId, i) => (
            <tr key={rowId} className="border-t border-border/50">
              <td className="text-left px-2 py-2 font-medium truncate">
                {labels[i]}
              </td>
              {groupTeamIds.map((colId) => {
                if (rowId === colId) {
                  return (
                    <td
                      key={colId}
                      className="text-center px-1 py-2 text-muted-foreground/40 bg-muted/20"
                    >
                      ■
                    </td>
                  );
                }
                const cell = findCell(matches, setsByMatch, rowId, colId);
                if (!cell) {
                  return (
                    <td
                      key={colId}
                      className="text-center px-1 py-2 text-muted-foreground/40"
                    >
                      —
                    </td>
                  );
                }
                const time = cell.scheduledAt
                  ? fmtTime(cell.scheduledAt)
                  : null;
                if (cell.pending) {
                  return (
                    <td
                      key={colId}
                      className="text-center px-1 py-1.5 tabular-nums"
                    >
                      <div className="text-muted-foreground">—</div>
                      {time && (
                        <div className="text-[9px] text-muted-foreground/60">
                          {time}
                        </div>
                      )}
                    </td>
                  );
                }
                const won = cell.setsForRow > cell.setsForCol;
                return (
                  <td
                    key={colId}
                    className="text-center px-1 py-1.5 tabular-nums"
                  >
                    <div
                      className={
                        cell.finished
                          ? won
                            ? "text-amber-300 font-semibold"
                            : "text-muted-foreground"
                          : "text-orange-300"
                      }
                    >
                      {cell.setsForRow}-{cell.setsForCol}
                    </div>
                    {time && (
                      <div className="text-[9px] text-muted-foreground/60">
                        {time}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
