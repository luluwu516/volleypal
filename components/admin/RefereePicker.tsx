"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import type { Match, Team } from "@/lib/db/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface Props {
  match: Match;
  slotMatches: Match[];
  teams: Team[];
  disabled?: boolean;
}

function teamName(id: string | null, teams: Team[]): string {
  if (!id) return "現場協調";
  return teams.find((t) => t.id === id)?.name ?? id.slice(0, 6);
}

/**
 * Inline referee editor for one match on the /admin/scheduler list.
 *
 * Options = teams that are NOT playing in any court this same time slot
 *   (rest teams for this slot). "現場協調" clears the assignment.
 *
 * A team that's already picked as referee for another court in the same slot
 * is still selectable (split-into-two-groups fallback for 8-teams / 3-courts),
 * but flagged with 「本時段已 X 場」 so the admin sees they're doubling up.
 */
export function RefereePicker({
  match,
  slotMatches,
  teams,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const playingTeamIds = new Set<string>();
  for (const m of slotMatches) {
    if (m.team_a_id) playingTeamIds.add(m.team_a_id);
    if (m.team_b_id) playingTeamIds.add(m.team_b_id);
  }
  const idleTeams = teams.filter((t) => !playingTeamIds.has(t.id));

  // Count how many matches in this slot already have team X as referee
  const refCountByTeam = new Map<string, number>();
  for (const m of slotMatches) {
    if (m.referee_team_id && m.id !== match.id) {
      refCountByTeam.set(
        m.referee_team_id,
        (refCountByTeam.get(m.referee_team_id) ?? 0) + 1,
      );
    }
  }

  const currentIsDoubled =
    match.referee_team_id != null &&
    (refCountByTeam.get(match.referee_team_id) ?? 0) >= 1;

  async function pick(teamId: string | null) {
    setOpen(false);
    if (teamId === match.referee_team_id) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/match/${match.id}/referee`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refereeTeamId: teamId }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "更新失敗");
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const displayName = teamName(match.referee_team_id, teams);
  const isUnassigned = match.referee_team_id === null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || pending}
          className={`inline-flex items-center gap-1 rounded border border-border/40 px-2 py-1.5 text-xs min-h-9 hover:bg-white/5 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
            isUnassigned ? "text-muted-foreground" : "text-foreground"
          }`}
          aria-label="選擇裁判"
        >
          <span>🦓 {displayName}</span>
          {currentIsDoubled && (
            <span
              className="text-amber-400"
              title="此隊本時段擔任多場裁判"
              aria-label="此隊本時段擔任多場裁判"
            >
              ⚠
            </span>
          )}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start">
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
          指派裁判
        </p>
        <ul className="flex flex-col max-h-72 overflow-y-auto">
          <li>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal text-muted-foreground"
              onClick={() => pick(null)}
            >
              現場協調(清空)
            </Button>
          </li>
          {idleTeams.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              本時段所有隊伍都在場上
            </li>
          ) : (
            idleTeams.map((t) => {
              const already = refCountByTeam.get(t.id) ?? 0;
              const isCurrent = t.id === match.referee_team_id;
              return (
                <li key={t.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-full justify-between font-normal ${
                      isCurrent ? "bg-white/5" : ""
                    }`}
                    onClick={() => pick(t.id)}
                  >
                    <span className="truncate">{t.name}</span>
                    {already > 0 && (
                      <span className="text-[10px] text-amber-400 shrink-0">
                        本時段已 {already} 場
                      </span>
                    )}
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
