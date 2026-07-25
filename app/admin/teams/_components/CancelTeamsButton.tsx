"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CancelTeamsButton({
  tournamentId,
  teamCount,
  disabled = false,
}: {
  tournamentId: string;
  teamCount: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  async function submit(pinToUse?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          ...(pinToUse ? { pin: pinToUse } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        // Server signals "wait, prove you're the admin"
        if (j.error === "pin_required") {
          setBusy(false);
          setOpen(false);
          setPinOpen(true);
          return;
        }
        throw new Error(j.error ?? "取消失敗");
      }
      toast.success("已取消分隊");
      setOpen(false);
      setPinOpen(false);
      setPin("");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (pinOpen) {
        setPinError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={disabled}>
            取消目前分隊
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消分隊?</DialogTitle>
            <DialogDescription>
              將刪除目前 {teamCount} 個隊伍和所有已建立的賽程,並需再次輸入 PIN 確認。報名名單會保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              返回
            </Button>
            <Button
              variant="destructive"
              onClick={() => submit()}
              disabled={busy}
            >
              {busy ? "處理中…" : "確認取消"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="border-red-500/50" showCloseButton={false}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPinError(null);
              submit(pin);
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-red-400" />
              <DialogTitle>確認取消分隊</DialogTitle>
            </div>
            <DialogDescription>
              目前有 {teamCount} 個隊伍。輸入你的 PIN 以確認清除所有隊伍與賽程。
            </DialogDescription>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              disabled={busy}
              autoComplete="current-password"
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
                variant="destructive"
                disabled={busy || pin.length < 4}
                className="flex-1"
              >
                {busy ? "處理中…" : "確認取消"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
