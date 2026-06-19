"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  matchId?: string;
  label?: string;
}

/**
 * Posts to /api/auth/lock then refreshes the route so server components see
 * the new locked state. Optional matchId pins scoring to a specific match.
 */
export function LockButton({ matchId, label = "鎖定 (裁判模式)" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/lock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(matchId ? { matchId } : {}),
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="w-full"
    >
      <Lock className="size-4" />
      {busy ? "鎖定中…" : label}
    </Button>
  );
}
