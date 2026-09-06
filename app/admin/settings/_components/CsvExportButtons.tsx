"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Small grid of four CSV download buttons under the JSON backup. One
// endpoint (`/api/admin/export/csv?kind=…`) serves all four; each button is
// a thin wrapper that picks the kind and triggers a Blob-download.

type Kind = "registrations" | "teams" | "schedule" | "results";
const OPTIONS: { kind: Kind; label: string }[] = [
  { kind: "registrations", label: "報名名單" },
  { kind: "teams", label: "隊伍名單" },
  { kind: "schedule", label: "賽程" },
  { kind: "results", label: "比分" },
];

export function CsvExportButtons() {
  const [busy, setBusy] = useState<Kind | null>(null);

  async function run(kind: Kind) {
    setBusy(kind);
    try {
      const res = await fetch(`/api/admin/export/csv?kind=${kind}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `volleypal-${kind}.csv`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`已下載 ${filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((o) => (
        <Button
          key={o.kind}
          variant="outline"
          onClick={() => run(o.kind)}
          disabled={busy !== null}
          className="justify-start"
        >
          <FileSpreadsheet className="size-4" />
          {busy === o.kind ? "匯出中…" : o.label}
        </Button>
      ))}
    </div>
  );
}
