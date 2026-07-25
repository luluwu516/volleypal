"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { GroupingStrategy } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
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

export function GenerateTeamsButton({
  tournamentId,
  existingCount,
  strategy,
  disabled = false,
}: {
  tournamentId: string;
  existingCount: number;
  strategy: GroupingStrategy;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = STRATEGY_COPY[strategy];
  const willReplace = existingCount > 0;

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/teams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "失敗");
      toast.success(`已產生 ${json.teams} 個隊伍`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              </>
            ) : (
              copy.describe
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={run}
            disabled={busy}
            variant={willReplace ? "destructive" : "default"}
          >
            {busy ? "處理中…" : willReplace ? "確認重新分隊" : "確認產生"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
