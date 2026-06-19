"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export function GenerateTeamsButton({
  tournamentId,
  existingCount,
  disabled = false,
}: {
  tournamentId: string;
  existingCount: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
        <Button disabled={disabled}>一鍵星座分隊</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>產生隊伍?</DialogTitle>
          <DialogDescription>
            {existingCount > 0
              ? `此操作將「刪除目前 ${existingCount} 個隊伍」並重新依星座分隊。已建立的賽程也會被清空。`
              : "依照所有報名者的生日分為四象 (火/土/風/水)，並均衡人數、性別、位置與實力。"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy ? "處理中…" : "確認產生"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
