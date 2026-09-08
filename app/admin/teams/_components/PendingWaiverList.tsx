"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import type { PendingWaiver, Registration } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

/**
 * Orphan waivers — submissions whose email didn't match any registration.
 * Admin's job: either match to a registration (name typo, form email had
 * an extra character, etc.) or delete if it's spam / a mis-submit.
 *
 * The section only renders when there ARE pending waivers, so it stays out
 * of the way during normal operation.
 */
export function PendingWaiverList({
  pending,
  registrations,
  disabled = false,
}: {
  pending: PendingWaiver[];
  registrations: Registration[];
  disabled?: boolean;
}) {
  if (pending.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
        未配對 waiver ({pending.length})
      </h2>
      <ul className="flex flex-col divide-y divide-border/40 rounded-lg border border-amber-500/40 bg-amber-500/5">
        {pending.map((p) => (
          <PendingRow
            key={p.id}
            pending={p}
            registrations={registrations}
            disabled={disabled}
          />
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        找不到對應報名 (email 不符 / 尚未報名)。配對後 waiver 會計入該球員。
      </p>
    </section>
  );
}

function PendingRow({
  pending,
  registrations,
  disabled,
}: {
  pending: PendingWaiver;
  registrations: Registration[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Empty query — show a small pre-filtered slice biased toward likely
    // matches: same email domain (if we have one), or all registrations that
    // don't yet have a waiver.
    const unsigned = registrations.filter((r) => !r.waiver_signed_at);
    if (!q) return unsigned.slice(0, 20);
    return unsigned
      .filter((r) => {
        const email = (r.email ?? "").toLowerCase();
        const name = r.name.toLowerCase();
        return email.includes(q) || name.includes(q);
      })
      .slice(0, 20);
  }, [query, registrations]);

  async function match(registrationId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/pending-waiver/${pending.id}/match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registration_id: registrationId }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("已配對");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (!confirm(`確定刪除 ${pending.name ?? pending.email ?? "此筆"} 的未配對 waiver?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pending-waiver/${pending.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("已刪除");
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{pending.name ?? "(未提供姓名)"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {pending.email ?? "(無 email)"}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {formatInTimeZone(new Date(pending.submitted_at), TZ, "MM/dd HH:mm")}
        </span>
      </div>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || busy}
              className="flex-1"
            >
              配對到…
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 max-h-80 overflow-y-auto p-2"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋姓名或 email"
              className="mb-2 h-8"
              autoFocus
            />
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">
                無符合的未簽署 waiver 報名者
              </p>
            ) : (
              <ul className="flex flex-col">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => match(c.id)}
                      disabled={busy}
                      className="w-full text-left rounded px-2 py-1.5 hover:bg-white/5 disabled:opacity-50"
                    >
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email ?? "(無 email)"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          variant="ghost"
          onClick={discard}
          disabled={disabled || busy}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          刪除
        </Button>
      </div>
    </li>
  );
}
