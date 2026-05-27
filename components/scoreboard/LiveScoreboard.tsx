"use client";

import { useEffect, useState } from "react";
import type { Match, MatchSet, Team, Tournament } from "@/lib/db/types";
import { MatchTimer } from "@/components/MatchTimer";

interface ApiPayload {
  tournament: Tournament | null;
  teams: Team[];
  matches: Match[];
  sets: MatchSet[];
}

const POLL_MS = 5000;

export function LiveScoreboard() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/scores", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (json.error) setError(json.error);
        else {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "fetch failed");
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (error)
    return (
      <p className="text-sm text-destructive text-center py-6">{error}</p>
    );
  if (!data)
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        載入中…
      </p>
    );

  const liveMatches = data.matches.filter((m) => m.status === "live");
  const upcoming = data.matches
    .filter((m) => m.status === "pending")
    .slice(0, 4);

  const setsByMatch = new Map<string, MatchSet[]>();
  for (const s of data.sets) {
    const list = setsByMatch.get(s.match_id) ?? [];
    list.push(s);
    setsByMatch.set(s.match_id, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {liveMatches.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          目前沒有進行中的比賽
        </p>
      )}
      {liveMatches.map((m) => (
        <ScoreCard
          key={m.id}
          match={m}
          teams={data.teams}
          sets={(setsByMatch.get(m.id) ?? []).sort(
            (a, b) => a.set_no - b.set_no,
          )}
          timeLimitMin={
            m.phase === "group"
              ? data.tournament?.group_stage_time_limit_min ?? null
              : null
          }
        />
      ))}
      {upcoming.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            接下來
          </h3>
          <ul className="flex flex-col gap-2">
            {upcoming.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border p-3 flex items-center justify-between text-sm"
              >
                <span>
                  {teamName(m.team_a_id, m.team_a_source, data.teams)} vs{" "}
                  {teamName(m.team_b_id, m.team_b_source, data.teams)}
                </span>
                <span className="text-muted-foreground text-xs">
                  Court {m.court ?? "?"}
                  {m.scheduled_at &&
                    ` · ${new Date(m.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function teamName(
  id: string | null,
  source: string | null,
  teams: Team[],
): string {
  if (id) return teams.find((t) => t.id === id)?.name ?? id.slice(0, 6);
  return source ?? "TBD";
}

function ScoreCard({
  match,
  teams,
  sets,
  timeLimitMin,
}: {
  match: Match;
  teams: Team[];
  sets: MatchSet[];
  timeLimitMin: number | null;
}) {
  const sortedSets = [...sets].sort((a, b) => a.set_no - b.set_no);
  const isLive = match.status === "live";
  const currentSet =
    sortedSets[sortedSets.length - 1] ??
    ({ score_a: 0, score_b: 0, set_no: 1 } as MatchSet);
  const a = teamName(match.team_a_id, match.team_a_source, teams);
  const b = teamName(match.team_b_id, match.team_b_source, teams);
  const serving = match.serving_team_id;

  // Ensure we always render 3 columns (Set 1/2/3) for consistent layout
  const displaySets = [1, 2, 3].map(
    (n) =>
      sortedSets.find((s) => s.set_no === n) ?? {
        match_id: match.id,
        set_no: n,
        score_a: 0,
        score_b: 0,
        finished_at: null,
        updated_at: "",
      },
  );

  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-4 ${
        isLive
          ? "border-orange-500/40 bg-orange-500/5"
          : "border-border/50"
      }`}
    >
      <div className="flex items-center justify-between text-xs">
        <span
          className={`font-semibold uppercase tracking-wider ${
            isLive ? "text-orange-400" : "text-muted-foreground"
          }`}
        >
          {isLive ? "● Live" : match.status} · Court {match.court ?? "?"} · Set{" "}
          {currentSet.set_no}
        </span>
        <MatchTimer
          startedAt={match.started_at}
          status={match.status}
          timeLimitMin={timeLimitMin}
        />
      </div>

      {/* Team names + ball possession */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center min-w-0">
          <p className="text-base font-semibold truncate">{a}</p>
          <p
            className={`text-base h-5 ${
              serving === match.team_a_id ? "" : "invisible"
            }`}
          >
            🏐
          </p>
        </div>
        <p className="text-sm text-muted-foreground">vs</p>
        <div className="text-center min-w-0">
          <p className="text-base font-semibold truncate">{b}</p>
          <p
            className={`text-base h-5 ${
              serving === match.team_b_id ? "" : "invisible"
            }`}
          >
            🏐
          </p>
        </div>
      </div>

      {/* Current set big score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="text-center text-6xl font-bold tabular-nums bg-gradient-to-br from-orange-500 to-amber-400 bg-clip-text text-transparent">
          {currentSet.score_a}
        </p>
        <p className="text-3xl text-muted-foreground">:</p>
        <p className="text-center text-6xl font-bold tabular-nums bg-gradient-to-br from-orange-500 to-amber-400 bg-clip-text text-transparent">
          {currentSet.score_b}
        </p>
      </div>

      {/* Per-set table */}
      <div className="border-t border-border/30 pt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-normal py-1 w-1/4"></th>
              {displaySets.map((s) => (
                <th
                  key={s.set_no}
                  className={`text-center font-normal py-1 ${
                    s.set_no === currentSet.set_no && isLive
                      ? "text-orange-400"
                      : ""
                  }`}
                >
                  Set {s.set_no}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 truncate text-xs">{a}</td>
              {displaySets.map((s) => {
                const isCurrent = s.set_no === currentSet.set_no && isLive;
                const won =
                  !isCurrent && s.score_a > 0 && s.score_a > s.score_b;
                return (
                  <td
                    key={s.set_no}
                    className={`text-center tabular-nums py-1 ${
                      isCurrent
                        ? "font-bold text-orange-300"
                        : won
                          ? "font-semibold text-amber-300"
                          : "text-muted-foreground"
                    }`}
                  >
                    {s.score_a || (isCurrent ? "0" : "—")}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-1 truncate text-xs">{b}</td>
              {displaySets.map((s) => {
                const isCurrent = s.set_no === currentSet.set_no && isLive;
                const won =
                  !isCurrent && s.score_b > 0 && s.score_b > s.score_a;
                return (
                  <td
                    key={s.set_no}
                    className={`text-center tabular-nums py-1 ${
                      isCurrent
                        ? "font-bold text-orange-300"
                        : won
                          ? "font-semibold text-amber-300"
                          : "text-muted-foreground"
                    }`}
                  >
                    {s.score_b || (isCurrent ? "0" : "—")}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
