"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { UserMinus, Trash2 } from "lucide-react";
import type { Registration } from "@/lib/db/types";
import {
  signFromBirthday,
  elementFromBirthday,
  ELEMENT_LABELS_ZH,
} from "@/lib/zodiac";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

const ELEMENT_DOT: Record<string, string> = {
  fire: "bg-red-500/80",
  earth: "bg-amber-600/80",
  air: "bg-violet-400/80",
  water: "bg-cyan-500/80",
};

const SIGN_ZH: Record<string, string> = {
  aries: "白羊",
  taurus: "金牛",
  gemini: "雙子",
  cancer: "巨蟹",
  leo: "獅子",
  virgo: "處女",
  libra: "天秤",
  scorpio: "天蠍",
  sagittarius: "射手",
  capricorn: "魔羯",
  aquarius: "水瓶",
  pisces: "雙魚",
};

export function RosterList({
  registrations,
  disabled = false,
}: {
  registrations: Registration[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(
    [...registrations].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
  );
  const [pending, startTransition] = useTransition();
  // Row targeted for deletion. Held in state so the PIN dialog stays mounted
  // independent of the Popover's own open/close (dismissing the Popover after
  // 「刪除報名」click should not also dismiss the pin prompt).
  const [pendingDelete, setPendingDelete] = useState<Registration | null>(null);

  async function updateSkill(id: string, raw: string) {
    const skill = raw === "" ? null : Number(raw);
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, skill_level: skill } : r)),
    );
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/registration/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill_level: skill }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Save failed");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  skill_level:
                    registrations.find((x) => x.id === id)?.skill_level ?? null,
                }
              : r,
          ),
        );
      }
    });
  }

  async function deactivate(id: string) {
    try {
      const res = await fetch(`/api/admin/registration/${id}/deactivate`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "退回候補失敗");
      }
      toast.success("已退回候補");
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        glyph="📋"
        title="尚未有已確認球員"
        body="兩個表單完成後,到候補分頁確認繳費,球員會出現在這裡。"
      />
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 grid grid-cols-[1fr_auto_auto_auto_4rem] gap-2 items-center">
          <span>名字</span>
          <span className="w-6 text-center" title="性別" aria-label="性別">
            ♀♂
          </span>
          <span className="w-8 text-center" title="舉球員" aria-label="舉球員">
            🙌🏻
          </span>
          <span className="w-12 text-center">星座</span>
          <span className="text-center">實力</span>
        </div>
        <ul className="divide-y divide-border/40">
          {rows.map((r) => {
            const birthday = r.birthday
              ? new Date(r.birthday + "T12:00:00")
              : null;
            const sign = birthday ? signFromBirthday(birthday) : null;
            const element = birthday ? elementFromBirthday(birthday) : null;
            return (
              <li
                key={r.id}
                className="px-3 py-2 grid grid-cols-[1fr_auto_auto_auto_4rem] gap-2 items-center text-sm"
              >
                <NameCell
                  registration={r}
                  disabled={disabled}
                  onDeactivate={() => deactivate(r.id)}
                  onDeleteRequested={() => setPendingDelete(r)}
                />
                <span className="w-6 text-center text-muted-foreground">
                  {r.gender === "female" ? "♀" : r.gender === "male" ? "♂" : "·"}
                </span>
                <span className="w-8 text-center" title={r.position}>
                  {r.position === "setter" ? "🙌🏻" : "—"}
                </span>
                <span className="w-12 text-center text-xs flex items-center justify-center gap-1">
                  {element && (
                    <span
                      className={`size-1.5 rounded-full ${ELEMENT_DOT[element]}`}
                      title={ELEMENT_LABELS_ZH[element]}
                    />
                  )}
                  <span className="text-muted-foreground">
                    {sign ? SIGN_ZH[sign] : "?"}
                  </span>
                </span>
                <SkillPicker
                  value={r.skill_level}
                  onChange={(v) => updateSkill(r.id, v)}
                  disabled={pending || disabled}
                />
              </li>
            );
          })}
        </ul>
        <p className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border/30">
          🙌🏻 = 舉球員 · 點名字看詳細 / 退回候補 / 刪除
        </p>
      </div>
      <DeleteRegistrationDialog
        target={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onDeleted={() => {
          setPendingDelete(null);
          startTransition(() => router.refresh());
        }}
      />
    </>
  );
}

function NameCell({
  registration,
  disabled,
  onDeactivate,
  onDeleteRequested,
}: {
  registration: Registration;
  disabled: boolean;
  onDeactivate: () => void;
  onDeleteRequested: () => void;
}) {
  const [open, setOpen] = useState(false);
  const r = registration;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="text-left font-medium truncate rounded px-1 -mx-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {r.name}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <p className="font-semibold">{r.name}</p>
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
          <span>確認時間</span>
          <span className="text-foreground">
            {r.confirmed_at
              ? formatInTimeZone(new Date(r.confirmed_at), TZ, "MM/dd HH:mm")
              : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
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

function DeleteRegistrationDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: Registration | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registration/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "刪除失敗");
      }
      toast.success("已刪除");
      setPin("");
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => {
        if (!o) {
          setPin("");
          setError(null);
          setBusy(false);
          onClose();
        }
      }}
    >
      <DialogContent className="border-red-500/50" showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogTitle>刪除 {target?.name}?</DialogTitle>
          <DialogDescription>
            此操作無法還原。若只是暫時移出球員列表,用「退回候補」。
            輸入你登入的 PIN 以確認刪除。
          </DialogDescription>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            disabled={busy}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || pin.length < 4}
              className="flex-1"
            >
              {busy ? "刪除中…" : "確認刪除"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Custom skill picker: native <select> on mobile puts its dropdown at odd
// positions (Chrome vertically aligns the highlighted option with the trigger
// text, which drifts if the trigger has vertical padding). A Popover anchors
// predictably below the trigger and lets us hit the 44pt touch target on the
// options themselves.
const SKILL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

function SkillPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (raw: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const display = value == null ? "—" : String(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="rounded border border-input bg-transparent px-2 min-h-9 text-sm text-center tabular-nums w-full hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`實力 ${display}`}
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-24 p-1" align="end">
        <ul className="flex flex-col">
          {SKILL_OPTIONS.map((opt) => {
            const isCurrent =
              (value == null && opt.value === "") ||
              String(value) === opt.value;
            return (
              <li key={opt.value || "clear"}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-center rounded px-2 min-h-9 text-sm tabular-nums hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    isCurrent ? "bg-white/10 font-semibold" : ""
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
