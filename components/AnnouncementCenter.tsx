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
          className="fixed inset-x-0 z-40 pointer-events-none"
          style={{
            top: "env(safe-area-inset-top)",
            paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
            paddingRight: "max(0.5rem, env(safe-area-inset-right))",
            paddingTop: "0.5rem",
          }}
        >
          <div className="mx-auto w-full max-w-md flex flex-col gap-2">
            {banners.map((a) => (
              <div
                key={a.id}
                className={`pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur-md ${
                  a.level === "warn"
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-100"
                    : "bg-purple-500/15 border-purple-500/50 text-purple-100"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Badge
                    variant="secondary"
                    className="uppercase text-[10px] tracking-wider shrink-0"
                  >
                    {a.level}
                  </Badge>
                  <p className="flex-1 leading-snug whitespace-pre-line">
                    {a.body}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismiss(a.id)}
                    className="shrink-0 -mr-1 size-5 grid place-items-center rounded hover:bg-white/10"
                    aria-label="關閉廣播"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ))}
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
