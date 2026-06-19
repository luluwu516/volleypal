"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  trigger: ReactNode;
}

/**
 * Reusable modal that prompts for the admin PIN and posts to /api/auth/unlock.
 * On success, refreshes the route so server components re-read the session and
 * the locked banner / disabled controls go away.
 */
export function UnlockDialog({ trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "解鎖失敗");
        setBusy(false);
        return;
      }
      setOpen(false);
      setPin("");
      router.refresh();
    } catch {
      setError("網路錯誤");
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setPin("");
          setError(null);
          setBusy(false);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-amber-500/50">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Lock className="size-5 text-amber-400" />
            <DialogTitle>解鎖管理員模式</DialogTitle>
          </div>
          <DialogDescription>
            輸入你登入時的 PIN 以離開裁判模式
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={busy || pin.length < 4}
            className="w-full"
          >
            {busy ? "解鎖中…" : "解鎖"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
