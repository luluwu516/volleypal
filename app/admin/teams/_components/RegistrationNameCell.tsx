"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { UserMinus, Trash2 } from "lucide-react";
import type { Registration } from "@/lib/db/types";
import { displayName, hasDistinctPreferred } from "@/lib/format/name";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

/**
 * Tap-to-detail cell shared by 球員列表 and 候補. Renders `preferred_name`
 * (falling back to legal `name`) as the click surface; the popover surfaces
 * the legal name plus admin actions.
 *
 * Actions differ by context:
 *   - `showDeactivate` → active roster shows "退回候補"
 *   - candidates only ever see 刪除報名 (deactivate is a no-op — they're
 *     already inactive), so the same component covers both tabs by toggling
 *     one flag.
 */
export function RegistrationNameCell({
  registration,
  disabled,
  showDeactivate,
  onDeactivate,
  onDeleteRequested,
  className,
}: {
  registration: Registration;
  disabled: boolean;
  showDeactivate: boolean;
  onDeactivate?: () => void;
  onDeleteRequested: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const r = registration;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={
            className ??
            "text-left font-medium truncate rounded px-1 -mx-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 disabled:cursor-not-allowed"
          }
        >
          {displayName(r)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <p className="font-semibold">{displayName(r)}</p>
          {hasDistinctPreferred(r) && (
            <p className="text-xs text-muted-foreground">
              正式姓名: <span className="text-foreground">{r.name}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground truncate">
            {r.email ?? "(無 email)"}
          </p>
          {r.phone && (
            <p className="text-xs text-muted-foreground">{r.phone}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>國籍</span>
          <span className="text-foreground">
            {r.is_taiwanese ? "台灣" : "非台灣"}
          </span>
          <span>Waiver</span>
          <span className="text-foreground">
            {r.waiver_signed_at
              ? formatInTimeZone(new Date(r.waiver_signed_at), TZ, "MM/dd HH:mm")
              : "未簽署"}
          </span>
          <span>{showDeactivate ? "確認時間" : "報名時間"}</span>
          <span className="text-foreground">
            {showDeactivate
              ? r.confirmed_at
                ? formatInTimeZone(new Date(r.confirmed_at), TZ, "MM/dd HH:mm")
                : "—"
              : formatInTimeZone(new Date(r.created_at), TZ, "MM/dd HH:mm")}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {showDeactivate && onDeactivate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                onDeactivate();
              }}
              disabled={disabled}
            >
              <UserMinus className="size-4" />
              退回候補
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false);
              onDeleteRequested();
            }}
            disabled={disabled}
            className="text-red-400 hover:text-red-300 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
          >
            <Trash2 className="size-4" />
            刪除報名
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
