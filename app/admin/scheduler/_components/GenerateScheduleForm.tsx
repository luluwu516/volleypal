"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  tournamentId: string;
  defaultCourts: number;
  defaultDuration: number;
  existingCount: number;
  teamCount: number;
  disabled?: boolean;
}

function defaultStart(): string {
  // Default to next Saturday 09:00 local time
  const d = new Date();
  const day = d.getDay();
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSat);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GenerateScheduleForm({
  tournamentId,
  defaultCourts,
  defaultDuration,
  existingCount,
  teamCount,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [courts, setCourts] = useState(defaultCourts);
  const [duration, setDuration] = useState(defaultDuration);
  const [startsAt, setStartsAt] = useState(defaultStart());
  const [busy, setBusy] = useState(false);

  async function run() {
    if (teamCount !== 8) {
      toast.error(`目前隊伍數為 ${teamCount}，需為 8 隊才能生成`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          numCourts: courts,
          matchDurationMin: duration,
          startsAt: new Date(startsAt).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "失敗");
      toast.success(`已生成 ${json.matches} 場比賽`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">生成 / 重排賽程</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <Label htmlFor="courts">場地數</Label>
          <Input
            id="courts"
            type="number"
            min={1}
            max={6}
            value={courts}
            onChange={(e) => setCourts(Number(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="duration">每場 (分)</Label>
          <Input
            id="duration"
            type="number"
            min={10}
            max={120}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="start">起始時間</Label>
          <Input
            id="start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            disabled={disabled}
          />
        </div>
        {existingCount > 0 && (
          <p className="text-xs text-amber-400">
            ⚠ 已有 {existingCount} 場比賽。pending 場次會被清除重排，已 finished 的會保留。
          </p>
        )}
        <Button onClick={run} disabled={busy || disabled}>
          {busy ? "生成中…" : "生成賽程"}
        </Button>
      </CardContent>
    </Card>
  );
}
