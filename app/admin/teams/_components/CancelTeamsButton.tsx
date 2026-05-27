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

export function CancelTeamsButton({
  tournamentId,
  teamCount,
}: {
  tournamentId: string;
  teamCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "失敗");
      toast.success("已取消分隊");
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
        <Button variant="outline">取消目前分隊</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>取消分隊?</DialogTitle>
          <DialogDescription>
            將刪除目前 {teamCount} 個隊伍和所有已建立的賽程。報名名單會保留。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            返回
          </Button>
          <Button variant="destructive" onClick={run} disabled={busy}>
            {busy ? "處理中…" : "確認取消"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
