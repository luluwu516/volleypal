"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Announcement } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

export function AnnouncementList({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const router = useRouter();
  async function dismiss(id: string) {
    try {
      const res = await fetch(`/api/admin/announcement/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }
  if (announcements.length === 0)
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        目前沒有廣播
      </p>
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
          <Button size="sm" variant="ghost" onClick={() => dismiss(a.id)}>
            刪除
          </Button>
        </li>
      ))}
    </ul>
  );
}
