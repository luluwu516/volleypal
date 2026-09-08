"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import type { Registration } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

interface Props {
  waitlist: Registration[];
  disabled?: boolean;
}

/**
 * Payment-verification queue. Two-step-per-row on purpose:
 *   1. Admin ticks the checkbox = "yes I've confirmed payment"
 *   2. Admin clicks 確認 = commit
 * Prevents a rogue tap from moving someone onto the roster prematurely.
 *
 * Server enforces caps (roster full / non-TW quota full) — the response
 * carries a `reason` code we surface inline in red so admin knows why the
 * click didn't take.
 */
export function WaitlistTable({ waitlist, disabled = false }: Props) {
  const router = useRouter();
  const [armed, setArmed] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Map<string, string>>(new Map());
  const [pending, startTransition] = useTransition();

  function toggleArm(id: string) {
    setArmed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Clear any prior error the moment the admin re-arms — stale error text
    // next to an armed checkbox is confusing.
    setErrorById((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  async function confirm(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/registration/${id}/confirm`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.message || json.error || `HTTP ${res.status}`;
        setErrorById((prev) => new Map(prev).set(id, msg));
        return;
      }
      toast.success("已加入球員列表");
      setArmed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorById((prev) => new Map(prev).set(id, msg));
    } finally {
      setBusyId(null);
    }
  }

  if (waitlist.length === 0) {
    return (
      <EmptyState
        glyph="⌛"
        title="候補名單為空"
        body="兩個表單都完成且未確認的球員會出現在這裡。"
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border/40 rounded-lg border">
      {waitlist.map((r) => {
        const isArmed = armed.has(r.id);
        const err = errorById.get(r.id);
        const isBusy = busyId === r.id || pending;
        return (
          <li key={r.id} className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label={`已收到 ${r.name} 的款項`}
                checked={isArmed}
                onChange={() => toggleArm(r.id)}
                disabled={disabled || isBusy}
                className="size-5 rounded border-input accent-emerald-500 shrink-0"
              />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-medium truncate">{r.name}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                    r.is_taiwanese
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {r.is_taiwanese ? "TW" : "非TW"}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {formatInTimeZone(new Date(r.created_at), TZ, "MM/dd HH:mm")}
              </span>
              <Button
                size="sm"
                onClick={() => confirm(r.id)}
                disabled={disabled || !isArmed || isBusy}
                className="shrink-0"
              >
                {isBusy && busyId === r.id ? "..." : "確認"}
              </Button>
            </div>
            {err && (
              <p className="text-xs text-red-400 pl-8">{err}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
