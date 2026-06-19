"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnlockDialog } from "@/components/UnlockDialog";

/**
 * Shown at the top of admin pages while session.locked === true. Pairs with
 * disabled controls on the page. Clicking the button opens the PIN prompt
 * to leave referee mode.
 */
export function LockedBanner() {
  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Lock className="size-4 text-amber-300 shrink-0" />
        <p className="text-sm text-amber-100 leading-snug">
          裁判模式 · 控制已鎖定
        </p>
      </div>
      <UnlockDialog
        trigger={
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400/60 text-amber-100 hover:bg-amber-500/20 shrink-0"
          >
            解鎖
          </Button>
        }
      />
    </div>
  );
}
