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
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("已發佈");
      setBody("");
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
      <fieldset disabled={disabled} className="flex flex-col gap-3 disabled:opacity-60">
        <Label htmlFor="body">訊息</Label>
        <Input
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="例如：午餐已到，請至大廳領取"
        />
        <div>
          <Label className="text-xs text-muted-foreground">等級</Label>
          <div className="flex items-center gap-2 mt-1.5">
            {(["info", "warn", "urgent"] as const).map((l) => (
              <Button
                key={l}
                type="button"
                variant={level === l ? "default" : "outline"}
                size="sm"
                onClick={() => setLevel(l)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">保留時間</Label>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
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
