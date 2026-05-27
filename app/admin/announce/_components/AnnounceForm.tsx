"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AnnounceForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<"info" | "warn" | "urgent">("info");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, body, level }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("已發佈");
      setBody("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border p-3">
      <Label htmlFor="body">訊息</Label>
      <Input
        id="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="例如：午餐已到，請至大廳領取"
      />
      <div className="flex items-center gap-2">
        {(["info", "warn", "urgent"] as const).map((l) => (
          <Button
            key={l}
            type="button"
            variant={level === l ? "default" : "outline"}
            size="sm"
            onClick={() => setLevel(l)}
          >
            {l}
          </Button>
        ))}
      </div>
      <Button type="submit" disabled={busy || !body.trim()}>
        {busy ? "發佈中…" : "發佈"}
      </Button>
    </form>
  );
}
