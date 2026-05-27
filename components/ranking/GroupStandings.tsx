import type { StandingRow } from "@/lib/ranking";
import type { Team } from "@/lib/db/types";

interface Props {
  standings: StandingRow[];
  teams: Team[];
  /** First N rows are above the promotion line (default 2 for 4-team group). */
  promote?: number;
}

export function GroupStandings({ standings, teams, promote = 2 }: Props) {
  const teamName = (id: string) =>
    teams.find((t) => t.id === id)?.name ?? id.slice(0, 6);
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">#</th>
            <th className="text-left px-3 py-2">隊伍</th>
            <th className="text-center px-2 py-2">勝</th>
            <th className="text-center px-2 py-2">負</th>
            <th className="text-center px-2 py-2">總得分</th>
            <th className="text-center px-2 py-2 tabular-nums">得失局</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const isPromotionEdge = i === promote - 1;
            return (
              <tr
                key={s.teamId}
                className={`border-t border-border/50 ${
                  isPromotionEdge ? "border-b-2 border-b-amber-400" : ""
                }`}
              >
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{teamName(s.teamId)}</td>
                <td className="text-center px-2 py-2">{s.wins}</td>
                <td className="text-center px-2 py-2">{s.losses}</td>
                <td className="text-center px-2 py-2 font-semibold">
                  {s.points}
                </td>
                <td className="text-center px-2 py-2 tabular-nums">
                  {s.setRatio.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="bg-amber-400/10 text-amber-400 text-xs px-3 py-1.5 text-center">
        — 晉級線 —
      </div>
      <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-t border-border/30">
        得失局 (Set Ratio) = 贏得局數 / 輸掉局數
      </p>
    </div>
  );
}
