"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Tail-trim affordance on each pending schedule row. Opens a PIN dialog
 * before hitting the cancel endpoint so admins can't fat-finger through
 * mid-event. Only mounts for `editable && status='pending'` — see
 * ScheduleList. Server-side the row is soft-canceled (status='canceled'),
 * not hard-deleted, so viewers still see it marked as cut.
 */
export function CancelMatchButton({
  matchId,
  label,
  disabled,
}: {
  matchId: string;
  label: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/schedule/match/${matchId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("已取消該場比賽");
      setOpen(false);
      setPin("");
      startTransition(() => router.refresh());
    } catch (e) {
      setPinError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || busy}
        className="shrink-0 grid place-items-center size-8 -m-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
        aria-label={`取消 ${label}`}
        title="取消此場比賽"
      >
        <X className="size-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setPin("");
            setPinError(null);
            setBusy(false);
          }
        }}
      >
        <DialogContent className="border-amber-500/50" showCloseButton={false}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-amber-400" />
              <DialogTitle>取消比賽</DialogTitle>
            </div>
            <DialogDescription>
              確定要取消「{label}」？此比賽將標記為已取消,球員在賽程 / 淘汰賽仍可看到,但不會進行。
              重新生成賽程可還原。輸入 PIN 確認。
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
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1"
              >
                返回
              </Button>
              <Button
                type="submit"
                disabled={busy || pin.length < 4}
                variant="destructive"
                className="flex-1"
              >
                {busy ? "取消中…" : "確認取消"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
