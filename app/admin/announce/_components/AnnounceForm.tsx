"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Expiry options offered on the form. Defaulting to 4h so PSAs don't linger
// in the bell drawer forever — most tournament-day messages are relevant only
// for a short window. "never" is still available for anything genuinely
// evergreen (venue changes, safety notices).
const EXPIRY_OPTIONS = [
  { label: "1 小時", hours: 1 },
  { label: "4 小時", hours: 4 },
  { label: "8 小時", hours: 8 },
  { label: "1 天", hours: 24 },
  { label: "永久", hours: null },
] as const;

const DEFAULT_HOURS = 4;

// Severity colours flow through in both selected and idle states so the
// admin sees at a glance which button they're about to hit. Urgent gets a
// strong red treatment even when idle — this action goes to every device
// in the tournament and a fat-finger tap should feel weighty.
const LEVEL_OPTIONS: Array<{
  value: "info" | "warn" | "urgent";
  dot: string;
  selected: string;
  idle: string;
}> = [
  {
    value: "info",
    dot: "bg-sky-400",
    selected: "border-sky-400 bg-sky-500/20 text-sky-100",
    idle: "border-border/60 text-muted-foreground hover:bg-white/5",
  },
  {
    value: "warn",
    dot: "bg-amber-400",
    selected: "border-amber-400 bg-amber-500/20 text-amber-100",
    idle: "border-border/60 text-muted-foreground hover:bg-amber-500/5",
  },
  {
    value: "urgent",
    dot: "bg-red-500",
    selected: "border-red-500 bg-red-500/25 text-red-100 shadow-sm shadow-red-500/30",
    // Idle uses the same neutral border as the other two — the red dot is
    // enough to identify severity, an idle red frame reads as "selected".
    idle: "border-border/60 text-muted-foreground hover:border-red-500/50 hover:bg-red-500/5 hover:text-red-200",
  },
];

export function AnnounceForm({
  tournamentId,
  disabled = false,
}: {
  tournamentId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<"info" | "warn" | "urgent">("info");
  const [expiryHours, setExpiryHours] = useState<number | null>(DEFAULT_HOURS);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const expiresAt =
        expiryHours == null
          ? undefined
          : new Date(Date.now() + expiryHours * 3600_000).toISOString();
      const res = await fetch("/api/admin/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, body, level, expiresAt }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "發佈失敗");
      }
      toast.success("已發佈");
      setBody("");
      setLevel("info");
      setExpiryHours(DEFAULT_HOURS);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="rounded-lg border p-3">
      <fieldset
        disabled={disabled}
        className="flex flex-col gap-3 min-w-0 disabled:opacity-60"
      >
        <Label htmlFor="body">訊息</Label>
        <Input
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="例如:午餐已到,請至大廳領取"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div>
          <Label className="text-xs text-muted-foreground">等級</Label>
          <div className="grid grid-cols-3 gap-2">
            {LEVEL_OPTIONS.map((opt) => {
              const selected = level === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLevel(opt.value)}
                  aria-label={opt.value}
                  aria-pressed={selected}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border min-h-9 px-2 text-xs uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    selected ? opt.selected : opt.idle
                  }`}
                >
                  <span
                    className={`size-2 rounded-full shrink-0 ${opt.dot}`}
                    aria-hidden
                  />
                  <span className="font-medium">{opt.value}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">保留時間</Label>
          <div className="flex flex-wrap items-center gap-2">
            {EXPIRY_OPTIONS.map((opt) => (
              <Button
                key={opt.label}
                type="button"
                variant={expiryHours === opt.hours ? "default" : "outline"}
                size="sm"
                onClick={() => setExpiryHours(opt.hours)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? "發佈中…" : "發佈"}
        </Button>
      </fieldset>
    </form>
  );
}
