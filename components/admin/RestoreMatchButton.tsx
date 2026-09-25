"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

/**
 * Undo a soft-cancel — puts the match back on the schedule as 'pending'.
 * Only mounts for `editable && status='canceled'` (see ScheduleList). No PIN:
 * restoring is non-destructive and this is the fix-a-mistake path. A confirm
 * still guards against a stray tap putting a canceled match back on the
 * players' schedule.
 */
export function RestoreMatchButton({
  matchId,
  label,
  disabled,
}: {
  matchId: string;
  label: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function run() {
    if (!confirm(`還原「${label}」？此比賽會重新出現在球員的賽程上。`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/schedule/match/${matchId}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("已還原該場比賽");
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || busy}
      className="shrink-0 grid place-items-center size-8 -m-1 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
      aria-label={`還原 ${label}`}
      title="還原此場比賽"
    >
      <RotateCcw className="size-4" />
    </button>
  );
}
