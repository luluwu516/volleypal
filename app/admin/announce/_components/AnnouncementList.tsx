"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Announcement } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

export function AnnouncementList({
  announcements,
  disabled = false,
}: {
  announcements: Announcement[];
  disabled?: boolean;
}) {
  const router = useRouter();
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
  return (
    <ul className="flex flex-col gap-2">
      {announcements.map((a) => (
        <li
          key={a.id}
          className="rounded-lg border p-3 flex items-start justify-between gap-2"
        >
          <div className="flex-1">
            <p className="text-xs uppercase text-muted-foreground">{a.level}</p>
            <p className="text-sm">{a.body}</p>
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
      ))}
    </ul>
  );
}
