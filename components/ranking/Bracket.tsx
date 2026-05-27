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
  const accentBorder =
    accent === "gold" ? "border-amber-400/40" : "border-purple-400/30";
  return (
    <div
      className={`rounded-lg border p-3 ${
        isLive
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
      </div>
      <div className="flex flex-col gap-1">
        <Row name={teamLabel(m.team_a_id, m.team_a_source, teams)} />
        <Row name={teamLabel(m.team_b_id, m.team_b_source, teams)} />
      </div>
      {m.referee_team_id && (
        <p className="text-[10px] text-muted-foreground mt-1">
          🦓 {teamLabel(m.referee_team_id, null, teams)}
        </p>
      )}
    </div>
  );
}

function Row({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{name}</span>
    </div>
  );
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
}: {
  matches: Match[];
  teams: Team[];
  accent: "gold" | "silver";
  semiPhase: Match["phase"];
  finalPhase: Match["phase"];
  thirdPhase: Match["phase"];
  finalTitle: string;
  thirdTitle: string;
}) {
  const semis = matches
    .filter((m) => m.phase === semiPhase)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const final = matches.find((m) => m.phase === finalPhase);
  const third = matches.find((m) => m.phase === thirdPhase);
  if (semis.length === 0 && !final) return null;
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
          />
        </section>
      )}
    </div>
  );
}
