"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAnnouncements } from "@/components/AnnouncementsProvider";

/**
 * Site-wide announcement display, driven by AnnouncementsProvider context:
 *   - level === "urgent" + unread: blocking modal until acked
 *   - level === "warn" | "info" + unread: top banner stack, dismissible
 *
 * Read history (including past-dismissed urgents) is viewed via NotificationBell.
 */
export function AnnouncementCenter() {
  const { items, dismiss, isDismissed } = useAnnouncements();
  const visible = items.filter((a) => !isDismissed(a.id));
  const urgent = visible.find((a) => a.level === "urgent");
  const banners = visible.filter((a) => a.level !== "urgent");

  return (
    <>
      {banners.length > 0 && (
        <div
          className="fixed inset-x-0 z-30 pointer-events-none"
          style={{
            // Banners live BELOW the sticky AppHeader (48px + safe-area).
            // z-30 keeps them under the header (z-40) but above content.
            top: "calc(env(safe-area-inset-top) + 3rem)",
            paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
            paddingRight: "max(0.5rem, env(safe-area-inset-right))",
            paddingTop: "0.5rem",
          }}
        >
          <div className="mx-auto w-full max-w-md flex flex-col gap-2">
            {banners.map((a) => {
              // Player-source broadcasts get red tinting even when they land
              // as `info` (i.e. downgraded past the global cap) so they
              // remain visually distinct from ordinary admin bulletins.
              const isPlayer = a.source === "player";
              const tone = isPlayer
                ? "bg-red-500/15 border-red-500/50 text-red-100"
                : a.level === "warn"
                  ? "bg-amber-500/15 border-amber-500/50 text-amber-100"
                  : "bg-purple-500/15 border-purple-500/50 text-purple-100";
              return (
              <div
                key={a.id}
                className={`pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur-md ${tone}`}
              >
                <div className="flex items-start gap-2">
                  <Badge
                    variant={isPlayer ? "destructive" : "secondary"}
                    className="uppercase text-[10px] tracking-wider shrink-0"
                  >
                    {isPlayer ? "player" : a.level}
                  </Badge>
                  <p className="flex-1 leading-snug whitespace-pre-line">
                    {a.body}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismiss(a.id)}
                    className="shrink-0 -mr-1 size-9 -my-1 grid place-items-center rounded hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label="關閉廣播"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(urgent)}
        onOpenChange={(open) => {
          if (!open && urgent) dismiss(urgent.id);
        }}
      >
        {urgent && (
          <DialogContent
            showCloseButton={false}
            className="border-red-500/60 bg-slate-950 shadow-red-500/30"
          >
            <div className="flex items-center gap-2">
              <Badge
                variant="destructive"
                className="uppercase text-[10px] tracking-wider"
              >
                URGENT
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(urgent.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <DialogTitle className="sr-only">緊急廣播</DialogTitle>
            <DialogDescription asChild>
              <p className="text-base font-medium text-red-100 whitespace-pre-line">
                {urgent.body}
              </p>
            </DialogDescription>
            <Button
              variant="destructive"
              onClick={() => dismiss(urgent.id)}
              className="w-full"
            >
              我知道了
            </Button>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
