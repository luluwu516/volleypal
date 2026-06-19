"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Registration } from "@/lib/db/types";
import {
  signFromBirthday,
  elementFromBirthday,
  ELEMENT_LABELS_ZH,
} from "@/lib/zodiac";

const ELEMENT_DOT: Record<string, string> = {
  fire: "bg-red-500/80",
  earth: "bg-amber-600/80",
  air: "bg-sky-400/80",
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
  const [rows, setRows] = useState(
    [...registrations].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
  );
  const [pending, startTransition] = useTransition();

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
        if (!res.ok) throw new Error((await res.json()).error || "Save failed");
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

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        尚未有報名資料
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 grid grid-cols-[1fr_auto_auto_auto_4rem] gap-2 items-center">
        <span>名字</span>
        <span className="w-6 text-center">性</span>
        <span className="w-8 text-center">位</span>
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
              <span className="font-medium truncate">{r.name}</span>
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
              <select
                value={r.skill_level ?? ""}
                onChange={(e) => updateSkill(r.id, e.target.value)}
                disabled={pending || disabled}
                className="rounded border border-input bg-transparent px-1 py-0.5 text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">—</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </li>
          );
        })}
      </ul>
      <p className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/30">
        🙌🏻 = 舉球員 · 實力下拉改完會自動儲存
      </p>
    </div>
  );
}
