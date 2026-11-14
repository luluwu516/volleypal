"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Re-enter-your-PIN gate for an irreversible action.
 *
 * The bar for using this is whether the action destroys something the app
 * can't rebuild — not how big it looks. A fat-fingered tap on a phone is the
 * threat model: `window.confirm` is one more tap in the same spot, which is
 * exactly the gesture a mis-tap repeats, while a PIN needs intent.
 *
 * `onConfirm` should throw on failure; the message is rendered inline and the
 * dialog stays open so the admin can retry or back out. It only closes on
 * success, via the caller clearing `open`.
 */
export function PinConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "確認刪除",
  busyLabel = "刪除中…",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: (pin: string) => Promise<void>;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPin("");
    setError(null);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(pin);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="border-red-500/50" showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
              {busy ? busyLabel : confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
