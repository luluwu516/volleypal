"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { GroupingStrategy } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STRATEGY_COPY: Record<
  GroupingStrategy,
  { label: string; describe: string }
> = {
  zodiac_together: {
    label: "一鍵分隊(同星座象)",
    describe:
      "依報名者生日分成火/土/風/水四象各兩隊,並均衡人數、性別、位置與實力。",
  },
  zodiac_mixed: {
    label: "一鍵分隊(打散星座象)",
    describe:
      "8 隊,每隊盡量各含火/土/風/水,並均衡性別、位置與實力。",
  },
  mbti_together: {
    label: "一鍵分隊(同 MBTI 氣質)",
    describe:
      "依 MBTI 分成理想家/思想家/守護家/藝術家四組各兩隊,並均衡人數、性別、位置與實力。",
  },
  mbti_mixed: {
    label: "一鍵分隊(打散 MBTI 氣質)",
    describe:
      "8 隊,每隊盡量各含不同氣質,並均衡性別、位置與實力。",
  },
};

// Common footnote appended to every strategy description so admins know the
// generated names are placeholders and where to rename.
const NAMING_HINT =
  "隊名產生為「隊伍 1」…「隊伍 8」,比賽當天球員取名後在隊伍卡片上手動改。";

export function GenerateTeamsButton({
  tournamentId,
  existingCount,
  strategy,
  teamsPublicAt = null,
  disabled = false,
}: {
  tournamentId: string;
  existingCount: number;
  strategy: GroupingStrategy;
  teamsPublicAt?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const copy = STRATEGY_COPY[strategy];
  const willReplace = existingCount > 0;
  // Roster is already visible to participants — flag the regen aggressively
  // so admin doesn't accidentally reshuffle after people have checked their
  // teams.
  const alreadyPublic =
    teamsPublicAt !== null && new Date(teamsPublicAt) <= new Date();

  async function run() {
    setBusy(true);
    setPinError(null);
    try {
      const res = await fetch("/api/admin/teams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          willReplace ? { tournamentId, pin } : { tournamentId },
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401 && willReplace) {
          setPinError(json.error === "pin_required" ? "請輸入 PIN" : "PIN 不正確");
          return;
        }
        throw new Error(json.error || "失敗");
      }
      toast.success(`已產生 ${json.teams} 個隊伍`);
      setOpen(false);
      setPin("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setPin("");
          setPinError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>{copy.label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>產生隊伍?</DialogTitle>
          <DialogDescription>
            {willReplace ? (
              <>
                將刪除目前 {existingCount} 個隊伍並重新分隊(策略:{copy.label.replace("一鍵分隊", "").replace(/[()]/g, "")})。已建立的賽程也會被清空。
                <span className="block mt-2 text-[11px]">{NAMING_HINT}</span>
              </>
            ) : (
              <>
                {copy.describe}
                <span className="block mt-2 text-[11px]">{NAMING_HINT}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {alreadyPublic && willReplace && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            ⚠ 名單已對參賽者公開,重新分隊會改變已公佈的組成。
            若確定要改,建議同時到頁首把「公開時間」重設為未來時間或「取消公開」。
          </div>
        )}
        {willReplace && (
          <div className="flex flex-col gap-1.5">
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="輸入你的 PIN 以確認"
              autoFocus
              disabled={busy}
            />
            {pinError && <p className="text-xs text-red-400">{pinError}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={run}
            disabled={busy || (willReplace && pin.length < 4)}
            variant={willReplace ? "destructive" : "default"}
          >
            {busy ? "處理中…" : willReplace ? "確認重新分隊" : "確認產生"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
