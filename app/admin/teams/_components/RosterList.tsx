"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Registration } from "@/lib/db/types";
import { displayName } from "@/lib/format/name";
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
import { EmptyState } from "@/components/EmptyState";
import { RegistrationNameCell } from "./RegistrationNameCell";
import { DeleteRegistrationDialog } from "./DeleteRegistrationDialog";

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
    [...registrations].sort((a, b) =>
      displayName(a).localeCompare(displayName(b), "zh-Hant"),
    ),
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
                <RegistrationNameCell
                  registration={r}
                  disabled={disabled}
                  showDeactivate
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
