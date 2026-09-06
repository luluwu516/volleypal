"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

// datetime-local input is timezone-naive: "2026-11-11T07:00" is just wall-clock
// digits. We interpret it as APP_TZ so admins in any browser TZ get the wall
// clock they meant. Reverse for rendering an existing UTC value back into the
// input.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd'T'HH:mm");
}
function fromDatetimeLocal(local: string): string | null {
  if (!local) return null;
  return fromZonedTime(local, TZ).toISOString();
}

export function PublishTimePicker({
  tournamentId,
  initialIso,
  matchDayDate,
  disabled = false,
}: {
  tournamentId: string;
  initialIso: string | null;
  matchDayDate: string | null; // "YYYY-MM-DD" from Postgres date column
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(toDatetimeLocal(initialIso));
  const [busy, setBusy] = useState(false);

  const publishAt = initialIso ? new Date(initialIso) : null;
  const isLive = publishAt !== null && publishAt <= new Date();
  const statusText = !publishAt
    ? "尚未設定"
    : isLive
      ? `已公開 (${formatInTimeZone(publishAt, TZ, "MM/dd HH:mm")} 起)`
      : `排定 ${formatInTimeZone(publishAt, TZ, "MM/dd HH:mm")} 公開`;
  const statusClass = isLive
    ? "text-emerald-400"
    : publishAt
      ? "text-amber-400"
      : "text-muted-foreground";
  const dirty = value !== toDatetimeLocal(initialIso);

  async function save(iso: string | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tournament/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Empty string is Zod's signal to null out the column (see route.ts).
        body: JSON.stringify({ teams_public_at: iso ?? "" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "儲存失敗");
      }
      toast.success(iso ? "公開時間已儲存" : "已取消公開時間");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function setMatchDay7am() {
    if (!matchDayDate) return;
    const iso = fromZonedTime(`${matchDayDate}T07:00`, TZ).toISOString();
    setValue(toDatetimeLocal(iso));
    void save(iso);
  }
  function setNow() {
    const iso = new Date().toISOString();
    setValue(toDatetimeLocal(iso));
    void save(iso);
  }
  function clear() {
    setValue("");
    void save(null);
  }

  return (
    <div className="rounded-lg border border-border/40 p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs min-w-0">
        <span className="uppercase tracking-wider text-muted-foreground shrink-0">
          隊伍名單公開時間
        </span>
        <span className={`font-medium truncate ${statusClass}`}>
          {statusText}
        </span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="datetime-local"
          className="flex-1 min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled || busy}
        />
        <Button
          size="sm"
          disabled={disabled || busy || !dirty}
          onClick={() => void save(fromDatetimeLocal(value))}
        >
          儲存
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {matchDayDate && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            onClick={setMatchDay7am}
          >
            比賽當天 07:00
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={setNow}
        >
          立刻公開
        </Button>
        {publishAt && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            onClick={clear}
          >
            取消公開
          </Button>
        )}
      </div>
    </div>
  );
}
