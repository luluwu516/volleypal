"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import type { Announcement } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

export function AnnouncementList({
  announcements,
  disabled = false,
}: {
  announcements: Announcement[];
  disabled?: boolean;
}) {
  const router = useRouter();
  // Rolling 24h count for the audit strip — enough context for admin to
  // spot abuse ("wait, we've had 8 player broadcasts today?") without a
  // dedicated dashboard. Frozen to mount time via lazy state initializer so
  // React purity rules are respected (Date.now during render is impure).
  // Declared above the empty-list early return so hook order stays stable.
  const [dayAgo] = useState(() => Date.now() - 24 * 3600_000);
  async function dismiss(id: string) {
    try {
      const res = await fetch(`/api/admin/announcement/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "刪除失敗");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }
  if (announcements.length === 0)
    return (
      <EmptyState
        glyph="📣"
        title="目前沒有廣播"
        body="用上方表單發佈第一則,球員 PWA 上會即時收到通知。"
      />
    );
  const playerToday = announcements.filter(
    (a) => a.source === "player" && new Date(a.created_at).getTime() > dayAgo,
  ).length;
  return (
    <>
      {playerToday > 0 && (
        <p className="text-[11px] text-muted-foreground mb-2">
          近 24h 球員廣播: <span className="text-foreground font-medium">{playerToday}</span> 則
          — 高於預期時可到「賽事設定」暫時關閉。
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {announcements.map((a) => {
          const isPlayer = a.source === "player";
          return (
            <li
              key={a.id}
              className={`rounded-lg border p-3 flex items-start justify-between gap-2 ${
                isPlayer ? "border-red-500/40 bg-red-500/5" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <Badge
                    variant={
                      a.level === "urgent" || isPlayer
                        ? "destructive"
                        : "secondary"
                    }
                    className="uppercase text-[10px] tracking-wider"
                  >
                    {a.level}
                  </Badge>
                  {isPlayer && (
                    <Badge
                      variant="outline"
                      className="text-[10px] tracking-wider border-red-500/50 text-red-300"
                    >
                      球員發送
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatInTimeZone(
                      new Date(a.created_at),
                      TZ,
                      "MM/dd HH:mm",
                    )}
                  </span>
                </div>
                <p className="text-sm break-words">{a.body}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismiss(a.id)}
                disabled={disabled}
              >
                刪除
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
