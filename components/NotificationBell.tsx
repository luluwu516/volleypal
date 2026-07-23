"use client";

import { Bell } from "lucide-react";
import { useAnnouncements } from "@/components/AnnouncementsProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatRelative(iso: string): string {
  const created = new Date(iso).getTime();
  const diff = Date.now() - created;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(iso).toLocaleDateString();
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const { items, dismissed, dismiss, markAllRead, unreadCount } =
    useAnnouncements();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative flex-1 flex items-center justify-center py-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={
            unreadCount > 0 ? `PSA，${unreadCount} 則未讀` : "PSA"
          }
        >
          <span className="relative">
            <Bell className="size-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[1rem] h-4 px-1 grid place-items-center text-[10px] font-bold rounded-full bg-red-500 text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="pr-8">
          <div className="flex items-center justify-between">
            <SheetTitle>廣播</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="text-xs"
              >
                全部標為已讀
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="flex flex-col gap-2 overflow-y-auto -mx-1 px-1 pb-1">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              目前沒有廣播
            </p>
          ) : (
            items.map((a) => {
              const unread = !dismissed.has(a.id);
              const accent =
                a.level === "urgent"
                  ? "border-red-500/50"
                  : a.level === "warn"
                    ? "border-amber-500/40"
                    : "border-purple-500/40";
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => {
                    if (unread) dismiss(a.id);
                  }}
                  className={`text-left rounded-lg border p-3 transition ${
                    unread
                      ? `bg-card ${accent}`
                      : "bg-muted/20 border-border/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={
                          a.level === "urgent" ? "destructive" : "secondary"
                        }
                        className="uppercase text-[10px] tracking-wider shrink-0"
                      >
                        {a.level}
                      </Badge>
                      {unread && (
                        <span
                          className="size-2 rounded-full bg-red-500 shrink-0"
                          aria-label="未讀"
                        />
                      )}
                    </div>
                    <span
                      className="text-xs text-muted-foreground shrink-0"
                      title={new Date(a.created_at).toLocaleString()}
                    >
                      {formatTimestamp(a.created_at)} · {formatRelative(a.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-line leading-snug">
                    {a.body}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
