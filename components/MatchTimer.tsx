"use client";

import { useEffect, useState } from "react";

interface Props {
  /** ISO timestamp when the match transitioned to "live". null = not started. */
  startedAt: string | null;
  /** Status of the match. */
  status: "pending" | "live" | "finished";
  /** Minutes cap for group-stage matches. null = no limit (knockout) — shows elapsed. */
  timeLimitMin?: number | null;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Match timer: countdown for group-stage matches, elapsed-time for others.
 * Updates every second client-side.
 */
export function MatchTimer({ startedAt, status, timeLimitMin }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "live") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (status === "pending") {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">
        尚未開始
      </span>
    );
  }
  if (!startedAt) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">--:--</span>
    );
  }

  const elapsedMs = now - new Date(startedAt).getTime();

  // No time cap → show elapsed
  if (!timeLimitMin) {
    return (
      <span className="tabular-nums text-xs text-muted-foreground">
        {status === "finished" ? "已結束" : "⏱ "}
        {status !== "finished" && fmt(elapsedMs)}
      </span>
    );
  }

  const remainingMs = timeLimitMin * 60_000 - elapsedMs;
  if (status === "finished") {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">已結束</span>
    );
  }
  if (remainingMs <= 0) {
    return (
      <span className="text-xs font-semibold text-red-400 tabular-nums">
        ⏰ 時間到
      </span>
    );
  }
  // Visual urgency: under 2 min red, under 5 min amber
  const cls =
    remainingMs < 2 * 60_000
      ? "text-red-400 font-semibold"
      : remainingMs < 5 * 60_000
        ? "text-amber-400"
        : "text-muted-foreground";
  return (
    <span className={`tabular-nums text-xs ${cls}`}>
      ⏱ 剩 {fmt(remainingMs)}
    </span>
  );
}
