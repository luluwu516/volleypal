"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Registration, Team } from "@/lib/db/types";
import { displayName } from "@/lib/format/name";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSkillStore } from "./SkillStore";

const ELEMENT_DOT: Record<string, string> = {
  fire: "bg-red-500/80",
  earth: "bg-amber-600/80",
  air: "bg-violet-400/80",
  water: "bg-cyan-500/80",
};

interface Member {
  registration_id: string;
  team_id: string;
}

/**
 * Confirmed players who aren't on any team — the other half of match-day
 * roster churn. 退回候補 drops a withdrawing player's team_members row to open
 * the seat, and confirming their replacement off the waitlist produces an
 * active player with nowhere to sit. Before this section existed that player
 * was invisible: the board only draws people who have a team, and the roster
 * list below says nothing about team membership.
 *
 * Modelled on 未配對 waiver deliberately — same amber treatment, same
 * "appears only when there's something to do" rule, so it costs no layout on
 * a page that's already long and admins read the colour the same way. It sits
 * directly under the board so the short team and the player who should fill
 * it are next to each other.
 */
export function UnassignedPlayers({
  players,
  teams,
  members,
  disabled = false,
}: {
  players: Registration[];
  teams: Team[];
  members: Member[];
  disabled?: boolean;
}) {
  if (players.length === 0 || teams.length === 0) return null;

  const sizeByTeam = new Map<string, number>(teams.map((t) => [t.id, 0]));
  for (const m of members) {
    sizeByTeam.set(m.team_id, (sizeByTeam.get(m.team_id) ?? 0) + 1);
  }
  // Teams below the fullest one are the ones with a seat going spare. Same
  // notion of "short" the board's imbalance banner uses, just per team.
  const fullest = Math.max(...sizeByTeam.values());

  return (
    <section>
      <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
        未分隊 ({players.length})
      </h2>
      <ul className="flex flex-col divide-y divide-border/40 rounded-lg border border-amber-500/40 bg-amber-500/5">
        {players.map((p) => (
          <UnassignedRow
            key={p.id}
            player={p}
            teams={teams}
            sizeByTeam={sizeByTeam}
            fullest={fullest}
            disabled={disabled}
          />
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        已確認但不在任何隊伍,通常是遞補退賽者留下的空位。分配後會計入該隊平均。
      </p>
    </section>
  );
}

function UnassignedRow({
  player,
  teams,
  sizeByTeam,
  fullest,
  disabled,
}: {
  player: Registration;
  teams: Team[];
  sizeByTeam: Map<string, number>;
  fullest: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const { withSkill } = useSkillStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const p = withSkill(player);

  async function assign(team: Team) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/team-members/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeamId: team.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success(`${displayName(p)} 已加入 ${team.name}`);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-2 px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{displayName(p)}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-2 tabular-nums">
          <span>
            {p.gender === "female" ? "♀" : p.gender === "male" ? "♂" : "·"}
          </span>
          {p.position === "setter" && <span>🙌🏻</span>}
          <span>Lv {p.skill_level ?? "?"}</span>
        </p>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" disabled={disabled || busy}>
            分配到…
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 max-h-80 overflow-y-auto p-1">
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
            分配到
          </p>
          <ul className="flex flex-col">
            {teams.map((t) => {
              const size = sizeByTeam.get(t.id) ?? 0;
              return (
                <li key={t.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between font-normal"
                    disabled={busy}
                    onClick={() => assign(t)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {t.element && (
                        <span
                          className={`size-2 rounded-full shrink-0 ${ELEMENT_DOT[t.element] ?? "bg-muted"}`}
                        />
                      )}
                      {t.temperament && (
                        <span className="text-[9px] font-semibold tracking-wider text-muted-foreground shrink-0">
                          {t.temperament}
                        </span>
                      )}
                      <span className="truncate">{t.name}</span>
                    </span>
                    {/* Short teams are the whole reason this list is open, so
                        they're the one thing allowed to shout. */}
                    <span
                      className={`text-xs tabular-nums shrink-0 ${
                        size < fullest
                          ? "text-amber-400 font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {size}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </li>
  );
}
