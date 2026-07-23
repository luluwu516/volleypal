"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import type { Registration, Team } from "@/lib/db/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { signFromBirthday } from "@/lib/zodiac";

const ELEMENT_DOT: Record<string, string> = {
  fire: "bg-red-500/80",
  earth: "bg-amber-600/80",
  air: "bg-sky-400/80",
  water: "bg-cyan-500/80",
};

interface Member {
  registration_id: string;
  team_id: string;
}

interface Props {
  teams: Team[];
  registrations: Registration[];
  initialMembers: Member[];
  disabled?: boolean;
}

function computeMetrics(members: Registration[]) {
  const female = members.filter((m) => m.gender === "female").length;
  const male = members.filter((m) => m.gender === "male").length;
  const setters = members.filter((m) => m.position === "setter").length;
  const skills = members.map((m) => m.skill_level).filter((n): n is number => typeof n === "number");
  const avgSkill = skills.length > 0 ? skills.reduce((a, b) => a + b, 0) / skills.length : null;
  return { female, male, setters, avgSkill };
}

export function TeamsBoard({
  teams,
  registrations,
  initialMembers,
  disabled = false,
}: Props) {
  const regById = useMemo(
    () => new Map(registrations.map((r) => [r.id, r])),
    [registrations],
  );

  // Local mirror of team_members → team_id so we can move without a page
  // refresh. Server confirms via PATCH; on failure we roll back this map.
  const [assignment, setAssignment] = useState<Map<string, string>>(
    () => new Map(initialMembers.map((m) => [m.registration_id, m.team_id])),
  );

  const membersByTeam = useMemo(() => {
    const out = new Map<string, Registration[]>();
    for (const [regId, teamId] of assignment) {
      const reg = regById.get(regId);
      if (!reg) continue;
      const list = out.get(teamId) ?? [];
      list.push(reg);
      out.set(teamId, list);
    }
    return out;
  }, [assignment, regById]);

  // Cross-team imbalance for the top warning banner
  const teamSizes = teams.map((t) => (membersByTeam.get(t.id) ?? []).length);
  const maxSize = teamSizes.length > 0 ? Math.max(...teamSizes) : 0;
  const minSize = teamSizes.length > 0 ? Math.min(...teamSizes) : 0;
  const diff = maxSize - minSize;
  const imbalanced = teams.length > 0 && diff > 1;

  async function move(registrationId: string, targetTeamId: string) {
    const prev = assignment.get(registrationId);
    if (!prev || prev === targetTeamId) return;
    // Optimistic
    setAssignment((old) => {
      const next = new Map(old);
      next.set(registrationId, targetTeamId);
      return next;
    });
    try {
      const res = await fetch(
        `/api/admin/team-members/${registrationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetTeamId }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "移動失敗");
      }
    } catch (e) {
      setAssignment((old) => {
        const next = new Map(old);
        next.set(registrationId, prev);
        return next;
      });
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  if (teams.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {imbalanced && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          ⚠ 各隊人數差異 {diff} (最多 {maxSize} 人,最少 {minSize} 人)
        </p>
      )}
      {teams.map((t) => {
        const teamMembers = membersByTeam.get(t.id) ?? [];
        const metrics = computeMetrics(teamMembers);
        return (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {t.element && (
                    <span
                      className={`size-2.5 rounded-full shrink-0 ${ELEMENT_DOT[t.element] ?? "bg-muted"}`}
                    />
                  )}
                  <span className="truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-normal shrink-0 tabular-nums">
                  <span>{teamMembers.length} 人</span>
                  {metrics.avgSkill != null && (
                    <span title="平均實力">Lv {metrics.avgSkill.toFixed(1)}</span>
                  )}
                  <span title="女 / 男">
                    ♀{metrics.female}·♂{metrics.male}
                  </span>
                  {metrics.setters > 0 && (
                    <span title="舉球員">🙌🏻{metrics.setters}</span>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {teamMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground">沒有成員</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {teamMembers.map((m) => {
                    const sign = m.birthday
                      ? signFromBirthday(new Date(m.birthday + "T12:00:00"))
                      : null;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between text-sm border-t border-border/40 first:border-t-0 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{m.name}</span>
                          {m.gender && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {m.gender === "female"
                                ? "♀"
                                : m.gender === "male"
                                  ? "♂"
                                  : "·"}
                            </span>
                          )}
                          {m.position === "setter" && (
                            <span className="text-xs shrink-0">🙌🏻</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                          {sign && <span className="opacity-60">{sign}</span>}
                          <span className="tabular-nums">
                            Lv{m.skill_level ?? "?"}
                          </span>
                          <MovePopover
                            currentTeamId={t.id}
                            teams={teams}
                            membersByTeam={membersByTeam}
                            onMove={(targetTeamId) => move(m.id, targetTeamId)}
                            disabled={disabled}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MovePopover({
  currentTeamId,
  teams,
  membersByTeam,
  onMove,
  disabled,
}: {
  currentTeamId: string;
  teams: Team[];
  membersByTeam: Map<string, Registration[]>;
  onMove: (targetTeamId: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const targets = teams.filter((t) => t.id !== currentTeamId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="size-6 grid place-items-center rounded hover:bg-white/10 disabled:opacity-40"
          aria-label="移動到其他隊伍"
        >
          <ArrowRightLeft className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="end">
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
          移動到
        </p>
        <ul className="flex flex-col">
          {targets.map((t) => {
            const size = (membersByTeam.get(t.id) ?? []).length;
            return (
              <li key={t.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between font-normal"
                  onClick={() => {
                    onMove(t.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    {t.element && (
                      <span
                        className={`size-2 rounded-full ${ELEMENT_DOT[t.element] ?? "bg-muted"}`}
                      />
                    )}
                    {t.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {size}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
