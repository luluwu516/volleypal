"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  async function submit(pinToUse?: string) {
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
          ...(pinToUse ? { pin: pinToUse } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Server tells us a PIN is needed (regeneration guard). Open dialog.
        if (json.error === "pin_required") {
          setPinOpen(true);
          return;
        }
        throw new Error(json.error || "失敗");
      }
      toast.success(`已生成 ${json.matches} 場比賽`);
      setPinOpen(false);
      setPin("");
      setPinError(null);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (pinOpen) setPinError(msg);
      else toast.error(msg);
    } finally {
      // Always reset — router.refresh() re-runs server components but keeps
      // client state, so without this the button sticks on "生成中…" after
      // a successful run.
      setBusy(false);
    }
  }

  async function run() {
    if (teamCount !== 8) {
      toast.error(`目前隊伍數為 ${teamCount}，需為 8 隊才能生成`);
      return;
    }
    await submit();
  }

  async function submitWithPin(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    await submit(pin);
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
            ⚠ 已有 {existingCount} 場比賽。pending 場次會被清除重排，已 finished 的會保留,重排需再次輸入 PIN。
          </p>
        )}
        <Button onClick={run} disabled={busy || disabled}>
          {busy ? "生成中…" : "生成賽程"}
        </Button>
      </CardContent>

      <Dialog
        open={pinOpen}
        onOpenChange={(o) => {
          setPinOpen(o);
          if (!o) {
            setPin("");
            setPinError(null);
            setBusy(false);
          }
        }}
      >
        <DialogContent className="border-amber-500/50" showCloseButton={false}>
          <form onSubmit={submitWithPin} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-amber-400" />
              <DialogTitle>確認重排賽程</DialogTitle>
            </div>
            <DialogDescription>
              已有賽程存在,輸入你的 PIN 以確認要清除 pending 場次並重新生成。
            </DialogDescription>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              disabled={busy}
            />
            {pinError && <p className="text-sm text-red-400">{pinError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPinOpen(false)}
                disabled={busy}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={busy || pin.length < 4}
                className="flex-1"
              >
                {busy ? "重排中…" : "確認重排"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
