"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Restore counterpart to ExportButton. Reads a JSON file client-side, opens
// a PIN-gated confirmation dialog with a summary of what's about to be
// overwritten, then POSTs to /api/admin/import.
export function ImportButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed?.tournament?.id) {
          toast.error("檔案格式不對:缺少 tournament 資料");
          return;
        }
        setPayload(parsed);
        setSummary(
          [
            `賽事：${parsed.tournament?.name ?? "?"} · ${parsed.tournament?.year ?? "?"}`,
            `報名 ${parsed.registrations?.length ?? 0}`,
            `隊伍 ${parsed.teams?.length ?? 0}`,
            `比賽 ${parsed.matches?.length ?? 0}`,
            `Sets ${parsed.match_sets?.length ?? 0}`,
            `廣播 ${parsed.announcements?.length ?? 0}`,
          ].join(" · "),
        );
        setOpen(true);
      } catch (err) {
        toast.error(
          `解析 JSON 失敗:${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        // Reset so choosing the same file again re-triggers change.
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, payload }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "匯入失敗");
      toast.success("匯入完成,頁面即將重新載入");
      setOpen(false);
      setPin("");
      setPayload(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        className="w-full"
      >
        <Upload className="size-4" />
        匯入賽事資料 (JSON)
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setPin("");
            setError(null);
            setBusy(false);
          }
        }}
      >
        <DialogContent
          className="border-red-500/50"
          showCloseButton={false}
        >
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-400" />
              <DialogTitle>確認覆蓋目前賽事</DialogTitle>
            </div>
            <DialogDescription>
              此操作會刪除目前所有賽事資料(隊伍、比賽、比分、廣播…),並以檔案內容整份取代。
              無法復原,請確定你有留當前的匯出檔。
            </DialogDescription>
            <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {summary}
            </div>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="輸入你的 PIN 以確認"
              disabled={busy}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
                {busy ? "匯入中…" : "確認覆蓋"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
