"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Registration } from "@/lib/db/types";
import { displayName } from "@/lib/format/name";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * PIN-gated destructive confirmation for hard-deleting a registration. Same
 * dialog is reused from the 球員列表 popover (RosterList) and 候補 popover
 * (WaitlistTable) — controlled by a `target` prop so the dialog can outlive
 * either popover being dismissed after "刪除報名" click.
 */
export function DeleteRegistrationDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: Registration | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registration/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "刪除失敗");
      }
      toast.success("已刪除");
      setPin("");
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => {
        if (!o) {
          setPin("");
          setError(null);
          setBusy(false);
          onClose();
        }
      }}
    >
      <DialogContent className="border-red-500/50" showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogTitle>刪除 {target ? displayName(target) : ""}?</DialogTitle>
          <DialogDescription>
            此操作無法還原。若只是暫時移出球員列表,用「退回候補」。
            輸入你登入的 PIN 以確認刪除。
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
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
              {busy ? "刪除中…" : "確認刪除"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
