"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Match, MatchSet, Team } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MatchTimer } from "@/components/MatchTimer";

interface Props {
  match: Match;
  teams: Team[];
  initialSets: MatchSet[];
  groupTimeLimitMin?: number | null;
}

const MAX_SETS = 3;

function teamName(id: string | null, source: string | null, teams: Team[]) {
  if (id) return teams.find((t) => t.id === id)?.name ?? id.slice(0, 6);
  return source ?? "TBD";
}

function findSet(sets: MatchSet[], no: number) {
  return sets.find((s) => s.set_no === no);
}

export function AdminScoreboard({
  match,
  teams,
  initialSets,
  groupTimeLimitMin,
}: Props) {
  const router = useRouter();
  const [sets, setSets] = useState<MatchSet[]>(
    [...initialSets].sort((a, b) => a.set_no - b.set_no),
  );
  const [status, setStatus] = useState(match.status);
  const [startedAt, setStartedAt] = useState<string | null>(match.started_at);
  const [servingTeamId, setServingTeamId] = useState<string | null>(
    match.serving_team_id,
  );
  // Default active tab: highest-set with any score, else 1
  const initialActive = (() => {
    const scored = [...sets]
      .reverse()
      .find((s) => s.score_a > 0 || s.score_b > 0);
    return scored?.set_no ?? 1;
  })();
  const [activeSet, setActiveSet] = useState(initialActive);
  const [pending, start] = useTransition();

  const a = teamName(match.team_a_id, match.team_a_source, teams);
  const b = teamName(match.team_b_id, match.team_b_source, teams);

  async function call(body: object) {
    const res = await fetch(`/api/match/${match.id}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Save failed");
    return json;
  }

  function bump(side: "a" | "b", delta: number) {
    const setNo = activeSet;
    const current = findSet(sets, setNo) ?? {
      match_id: match.id,
      set_no: setNo,
      score_a: 0,
      score_b: 0,
      finished_at: null,
      updated_at: new Date().toISOString(),
    };
    const optimistic = upsertSet(sets, {
      ...current,
      score_a: side === "a" ? Math.max(0, current.score_a + delta) : current.score_a,
      score_b: side === "b" ? Math.max(0, current.score_b + delta) : current.score_b,
    });
    setSets(optimistic);
    // Optimistic serve update: scoring team gets the serve (rally point)
    if (delta > 0) {
      const newServer =
        side === "a" ? match.team_a_id : match.team_b_id;
      setServingTeamId(newServer);
    }
    start(async () => {
      try {
        const json = await call({ action: "bump", side, delta, setNo });
        setSets(json.sets);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        setSets(initialSets);
      }
    });
  }

  function setStatusAction(next: Match["status"], winnerSide?: "a" | "b") {
    start(async () => {
      try {
        const res = await fetch(`/api/match/${match.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next, winnerSide }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Save failed");
        setStatus(next);
        if (next === "live" && !startedAt) setStartedAt(new Date().toISOString());
        if (next === "finished") toast.success("已結束");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function setServing(side: "a" | "b" | null) {
    const teamId = side === "a" ? match.team_a_id : side === "b" ? match.team_b_id : null;
    setServingTeamId(teamId);
    start(async () => {
      try {
        const res = await fetch(`/api/match/${match.id}/serving`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ side }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        setServingTeamId(match.serving_team_id);
      }
    });
  }

  const current = findSet(sets, activeSet) ?? {
    match_id: match.id,
    set_no: activeSet,
    score_a: 0,
    score_b: 0,
    finished_at: null,
    updated_at: new Date().toISOString(),
  };

  const totalA = sets.reduce((s, x) => s + x.score_a, 0);
  const totalB = sets.reduce((s, x) => s + x.score_b, 0);
  let setsWonA = 0;
  let setsWonB = 0;
  for (const s of sets) {
    if (s.score_a === 0 && s.score_b === 0) continue;
    if (s.score_a > s.score_b) setsWonA++;
    else if (s.score_b > s.score_a) setsWonB++;
  }
  const autoWinner: "a" | "b" | null =
    totalA > totalB ? "a" : totalB > totalA ? "b" : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>
            {match.phase} · Court {match.court ?? "?"} · 狀態: {status}
          </span>
          <MatchTimer
            startedAt={startedAt}
            status={status}
            timeLimitMin={groupTimeLimitMin}
          />
        </div>
        {match.referee_team_id && (
          <p>
            🦓 裁判：
            {teams.find((t) => t.id === match.referee_team_id)?.name ??
              match.referee_team_id.slice(0, 6)}
          </p>
        )}
      </div>

      {/* Set tabs */}
      <Tabs
        value={String(activeSet)}
        onValueChange={(v) => setActiveSet(Number(v))}
      >
        <TabsList className="w-full">
          {Array.from({ length: MAX_SETS }, (_, i) => i + 1).map((n) => {
            const s = findSet(sets, n);
            const hasScore = s && (s.score_a > 0 || s.score_b > 0);
            return (
              <TabsTrigger key={n} value={String(n)} className="flex-1">
                Set {n}
                {hasScore && (
                  <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                    {s!.score_a}-{s!.score_b}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={String(activeSet)} className="mt-4">
          <div className="rounded-2xl border p-4 grid grid-cols-2 gap-4">
            <Side
              name={a}
              score={current.score_a}
              onPlus={() => bump("a", 1)}
              onMinus={() => bump("a", -1)}
              disabled={pending || status !== "live"}
            />
            <Side
              name={b}
              score={current.score_b}
              onPlus={() => bump("b", 1)}
              onMinus={() => bump("b", -1)}
              disabled={pending || status !== "live"}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Serving — admin only picks once at the start (captain coin toss).
          After that, the serve auto-flips to whoever just scored. */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            開球
          </p>
          <p className="text-[10px] text-muted-foreground">
            得分後自動換球
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={servingTeamId === match.team_a_id ? "default" : "outline"}
            size="sm"
            onClick={() => setServing("a")}
            disabled={pending || status === "finished"}
          >
            🏐 {a}
          </Button>
          <Button
            variant={servingTeamId === match.team_b_id ? "default" : "outline"}
            size="sm"
            onClick={() => setServing("b")}
            disabled={pending || status === "finished"}
          >
            🏐 {b}
          </Button>
        </div>
      </div>

      {/* Sets-won + total scores + auto winner */}
      <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1 text-center">
            勝局數
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className="text-center text-2xl font-semibold tabular-nums text-purple-300">
              {setsWonA}
            </p>
            <p className="text-xl text-muted-foreground">:</p>
            <p className="text-center text-2xl font-semibold tabular-nums text-purple-300">
              {setsWonB}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1 text-center">
            總得分
          </p>
          <div className="grid grid-cols-2 gap-3">
            <SideTotal name={a} total={totalA} winning={autoWinner === "a"} />
            <SideTotal name={b} total={totalB} winning={autoWinner === "b"} />
          </div>
        </div>
        {totalA === totalB && totalA > 0 && (
          <p className="text-xs text-amber-400 text-center">
            兩方平手，需手動決定勝負
          </p>
        )}
      </div>

      {/* Status controls */}
      <div className="grid grid-cols-2 gap-2">
        {status === "pending" && (
          <Button
            className="col-span-2"
            onClick={() => setStatusAction("live")}
            disabled={pending}
          >
            開始比賽
          </Button>
        )}
        {status === "live" && (
          <>
            {autoWinner ? (
              <Button
                className="col-span-2"
                onClick={() => setStatusAction("finished", autoWinner)}
                disabled={pending}
              >
                結束比賽 ({autoWinner === "a" ? a : b} 勝)
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStatusAction("finished", "a")}
                  disabled={pending}
                >
                  {a} 勝
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStatusAction("finished", "b")}
                  disabled={pending}
                >
                  {b} 勝
                </Button>
              </>
            )}
          </>
        )}
        {status === "finished" && (
          <Button
            variant="ghost"
            className="col-span-2"
            onClick={() => setStatusAction("live")}
            disabled={pending}
          >
            重新開放 (修正)
          </Button>
        )}
      </div>
    </div>
  );
}

function upsertSet(sets: MatchSet[], updated: MatchSet): MatchSet[] {
  const i = sets.findIndex((s) => s.set_no === updated.set_no);
  if (i === -1) return [...sets, updated].sort((a, b) => a.set_no - b.set_no);
  const out = [...sets];
  out[i] = updated;
  return out;
}

function Side({
  name,
  score,
  onPlus,
  onMinus,
  disabled,
}: {
  name: string;
  score: number;
  onPlus: () => void;
  onMinus: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-medium truncate w-full text-center">{name}</p>
      <button
        type="button"
        onClick={onPlus}
        disabled={disabled}
        className="w-full text-6xl font-bold tabular-nums bg-gradient-to-br from-orange-500 to-amber-400 bg-clip-text text-transparent py-2 rounded hover:bg-orange-500/10 disabled:opacity-50"
      >
        {score}
      </button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onMinus}
        disabled={disabled || score === 0}
      >
        −1
      </Button>
    </div>
  );
}

function SideTotal({
  name,
  total,
  winning,
}: {
  name: string;
  total: number;
  winning: boolean;
}) {
  return (
    <div
      className={`rounded-md py-2 px-3 text-center ${
        winning ? "bg-amber-400/15 ring-1 ring-amber-400/40" : ""
      }`}
    >
      <p className="text-xs text-muted-foreground truncate">{name}</p>
      <p
        className={`text-3xl font-bold tabular-nums ${
          winning ? "text-amber-300" : ""
        }`}
      >
        {total}
        {winning && <span className="text-xs ml-1">👑</span>}
      </p>
    </div>
  );
}
