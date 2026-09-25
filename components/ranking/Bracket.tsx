import type { Match, Team } from "@/lib/db/types";

interface Props {
  matches: Match[];
  teams: Team[];
}

const teamLabel = (
  id: string | null,
  source: string | null,
  teams: Team[],
) => {
  if (id) return teams.find((t) => t.id === id)?.name ?? id.slice(0, 6);
  return source ?? "TBD";
};

function MatchCard({
  m,
  teams,
  title,
  accent,
}: {
  m: Match;
  teams: Team[];
  title: string;
  accent: "gold" | "silver";
}) {
  const isLive = m.status === "live";
  const isFinished = m.status === "finished";
  const isCanceled = m.status === "canceled";
  const accentBorder =
    accent === "gold" ? "border-amber-400/40" : "border-purple-400/30";
  return (
    <div
      className={`rounded-lg border p-3 ${
        isCanceled
          ? "border-dashed border-red-500/40 bg-red-500/5 opacity-70"
          : isLive
            ? "border-orange-500/50 bg-orange-500/5"
            : isFinished
              ? `${accentBorder} opacity-80`
              : accentBorder
      }`}
    >
      <div
        className={`text-xs uppercase mb-2 ${
          accent === "gold" ? "text-amber-300/80" : "text-purple-300/80"
        }`}
      >
        {title}
        {isCanceled && (
          <span className="ml-1.5 normal-case text-red-300">· 已取消</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Row
          name={teamLabel(m.team_a_id, m.team_a_source, teams)}
          struck={isCanceled}
        />
        <Row
          name={teamLabel(m.team_b_id, m.team_b_source, teams)}
          struck={isCanceled}
        />
      </div>
      {m.referee_team_id && !isCanceled && (
        <p className="text-xs text-muted-foreground mt-1">
          🦓 {teamLabel(m.referee_team_id, null, teams)}
        </p>
      )}
    </div>
  );
}

function Row({ name, struck }: { name: string; struck?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-sm ${
          struck ? "line-through text-muted-foreground" : ""
        }`}
      >
        {name}
      </span>
    </div>
  );
}

function loserOf(m: Match): string | null {
  if (!m.winner_team_id || !m.team_a_id || !m.team_b_id) return null;
  return m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
}

function BracketSection({
  matches,
  teams,
  accent,
  semiPhase,
  finalPhase,
  thirdPhase,
  finalTitle,
  thirdTitle,
  tiedRankLabel,
}: {
  matches: Match[];
  teams: Team[];
  accent: "gold" | "silver";
  semiPhase: Match["phase"];
  finalPhase: Match["phase"];
  thirdPhase: Match["phase"];
  finalTitle: string;
  thirdTitle: string;
  /** Shown when the placement match is absent — e.g. "並列 3 名". */
  tiedRankLabel: string;
}) {
  const semis = matches
    .filter((m) => m.phase === semiPhase)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const final = matches.find((m) => m.phase === finalPhase);
  const thirdRow = matches.find((m) => m.phase === thirdPhase);
  // "Present" = a live placement match that will actually be played. A
  // canceled row is kept in the DB (so users still see the match was cut)
  // but for bracket-fill purposes it's treated the same as "row doesn't
  // exist" — semi losers get displayed as tied.
  const third =
    thirdRow && thirdRow.status !== "canceled" ? thirdRow : undefined;
  if (semis.length === 0 && !final) return null;

  // Placement match missing (skipped by settings, or canceled by admin) →
  // display the two semi losers as tied. Only meaningful once both semis
  // have finished; until then we just hide the tile.
  const bothSemisFinished =
    semis.length === 2 && semis.every((m) => m.status === "finished");
  const showTied = !third && bothSemisFinished;
  const wasCanceled = thirdRow?.status === "canceled";
  const tiedLosers = showTied
    ? semis
        .map((m) => loserOf(m))
        .filter((id): id is string => Boolean(id))
    : [];

  return (
    <div className="grid grid-cols-2 gap-3 items-center">
      <div className="flex flex-col gap-3">
        {semis.map((m, i) => (
          <MatchCard
            key={m.id}
            m={m}
            teams={teams}
            title={`Semi ${i + 1}`}
            accent={accent}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {final && (
          <MatchCard m={final} teams={teams} title={finalTitle} accent={accent} />
        )}
        {third && (
          <MatchCard m={third} teams={teams} title={thirdTitle} accent={accent} />
        )}
        {wasCanceled && !showTied && (
          <div
            className={`rounded-lg border border-dashed p-3 opacity-70 ${
              accent === "gold"
                ? "border-amber-400/40"
                : "border-purple-400/30"
            }`}
          >
            <div className="text-xs uppercase mb-1 text-red-300">
              {thirdTitle}已取消
            </div>
            <p className="text-[11px] text-muted-foreground">
              準決賽結束後兩隊並列
            </p>
          </div>
        )}
        {showTied && (
          <div
            className={`rounded-lg border border-dashed p-3 ${
              accent === "gold"
                ? "border-amber-400/40"
                : "border-purple-400/30"
            }`}
          >
            <div
              className={`text-xs uppercase mb-2 ${
                accent === "gold"
                  ? "text-amber-300/80"
                  : "text-purple-300/80"
              }`}
            >
              {tiedRankLabel}
              {wasCanceled && (
                <span className="ml-1.5 normal-case text-[10px] text-red-300">
                  · {thirdTitle}已取消
                </span>
              )}
            </div>
            {tiedLosers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                準決賽結束後顯示
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {tiedLosers.map((id) => (
                  <Row
                    key={id}
                    name={
                      teams.find((t) => t.id === id)?.name ?? id.slice(0, 6)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Bracket({ matches, teams }: Props) {
  const hasGold = matches.some((m) =>
    ["semifinal", "final", "third_place"].includes(m.phase),
  );
  const hasSilver = matches.some((m) =>
    ["silver_semifinal", "silver_final", "silver_third_place"].includes(
      m.phase,
    ),
  );

  if (!hasGold && !hasSilver) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        淘汰賽尚未建立。預賽結束後將自動填入。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {hasGold && (
        <section>
          <h3 className="text-sm font-semibold mb-2 text-amber-300">
            🥇 Gold (1-4 名)
          </h3>
          <BracketSection
            matches={matches}
            teams={teams}
            accent="gold"
            semiPhase="semifinal"
            finalPhase="final"
            thirdPhase="third_place"
            finalTitle="決賽"
            thirdTitle="季軍戰"
            tiedRankLabel="並列 3 名"
          />
        </section>
      )}
      {hasSilver && (
        <section>
          <h3 className="text-sm font-semibold mb-2 text-purple-300">
            🥈 Silver (5-8 名)
          </h3>
          <BracketSection
            matches={matches}
            teams={teams}
            accent="silver"
            semiPhase="silver_semifinal"
            finalPhase="silver_final"
            thirdPhase="silver_third_place"
            finalTitle="5-6 名"
            thirdTitle="7-8 名"
            tiedRankLabel="並列 7 名"
          />
        </section>
      )}
    </div>
  );
}
