"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Tournament } from "@/lib/db/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  tournament: Tournament;
}

export function TournamentSettingsForm({ tournament }: Props) {
  const router = useRouter();
  const [numCourts, setNumCourts] = useState(tournament.num_courts);
  const [matchDuration, setMatchDuration] = useState(
    tournament.match_duration_min,
  );
  const [groupTimeLimit, setGroupTimeLimit] = useState(
    tournament.group_stage_time_limit_min ?? 0,
  );
  const [rulesUrl, setRulesUrl] = useState(tournament.rules_doc_url ?? "");
  const [regUrl, setRegUrl] = useState(tournament.registration_form_url ?? "");
  const [address, setAddress] = useState(tournament.venue_address ?? "");
  const [transport, setTransport] = useState(tournament.venue_transport ?? "");
  const [lunch, setLunch] = useState(tournament.venue_lunch_options ?? "");
  const [drink, setDrink] = useState(tournament.venue_drink_options ?? "");
  const [dinnerName, setDinnerName] = useState(
    tournament.dinner_venue_name ?? "",
  );
  const [dinnerAddress, setDinnerAddress] = useState(
    tournament.dinner_venue_address ?? "",
  );
  const [nearby, setNearby] = useState(tournament.venue_nearby ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tournament/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num_courts: numCourts,
          match_duration_min: matchDuration,
          group_stage_time_limit_min: groupTimeLimit || null,
          rules_doc_url: rulesUrl || null,
          registration_form_url: regUrl || null,
          venue_address: address || null,
          venue_transport: transport || null,
          venue_lunch_options: lunch || null,
          venue_drink_options: drink || null,
          dinner_venue_name: dinnerName || null,
          dinner_venue_address: dinnerAddress || null,
          venue_nearby: nearby || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("已儲存");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {tournament.name} · {tournament.year}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <Label htmlFor="courts">場地數</Label>
          <Input
            id="courts"
            type="number"
            min={1}
            max={6}
            value={numCourts}
            onChange={(e) => setNumCourts(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="duration">每場長度 (分)</Label>
          <Input
            id="duration"
            type="number"
            min={10}
            max={120}
            value={matchDuration}
            onChange={(e) => setMatchDuration(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="limit">預賽單場時間上限 (分)</Label>
          <Input
            id="limit"
            type="number"
            min={0}
            max={120}
            value={groupTimeLimit}
            onChange={(e) => setGroupTimeLimit(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            時間到當下比分高的一方獲勝。留 0 = 不限時，照正規規則打到三戰兩勝。
          </p>
        </div>

        <div className="border-t border-border/40 pt-3 mt-1">
          <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wider">
            比賽詳情連結
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="rules">競賽規章 URL</Label>
              <Input
                id="rules"
                type="url"
                placeholder="https://docs.google.com/..."
                value={rulesUrl}
                onChange={(e) => setRulesUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reg">報名表單 URL</Label>
              <Input
                id="reg"
                type="url"
                placeholder="https://forms.gle/..."
                value={regUrl}
                onChange={(e) => setRegUrl(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 pt-3">
          <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wider">
            場館資訊
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="address">場館地址（用於導航按鈕）</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例如：123 Main St, Los Angeles, CA 90001"
              />
            </div>
            <div>
              <Label htmlFor="transport">交通</Label>
              <textarea
                id="transport"
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                placeholder="例如：地鐵 7 號線 XX 站 5 號出口 步行 8 分鐘"
              />
            </div>
            <div>
              <Label htmlFor="nearby">其他補給</Label>
              <textarea
                id="nearby"
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={nearby}
                onChange={(e) => setNearby(e.target.value)}
                placeholder="例如：旁邊 7-11，急救藥局在轉角"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 pt-3">
          <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wider">
            食物選擇
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="dinnerName">晚餐餐廳名稱</Label>
              <Input
                id="dinnerName"
                value={dinnerName}
                onChange={(e) => setDinnerName(e.target.value)}
                placeholder="例如：鼎泰豐"
              />
            </div>
            <div>
              <Label htmlFor="dinnerAddr">晚餐餐廳地址（用於導航）</Label>
              <Input
                id="dinnerAddr"
                value={dinnerAddress}
                onChange={(e) => setDinnerAddress(e.target.value)}
                placeholder="例如：1108 S Baldwin Ave, Arcadia, CA 91007"
              />
            </div>
            <div>
              <Label htmlFor="lunch">午餐選擇（每行一項）</Label>
              <textarea
                id="lunch"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={lunch}
                onChange={(e) => setLunch(e.target.value)}
                placeholder={
                  "Chick-fil-A\nIn-N-Out | https://www.in-n-out.com\n附近便當店"
                }
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                格式：每行一項，可加 ` | 網址` 變成可點連結
              </p>
            </div>
            <div>
              <Label htmlFor="drink">飲料選擇（每行一項）</Label>
              <textarea
                id="drink"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={drink}
                onChange={(e) => setDrink(e.target.value)}
                placeholder={"TP Tea\nDing Tea | https://example.com"}
              />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={busy}>
          {busy ? "儲存中…" : "儲存"}
        </Button>
      </CardContent>
    </Card>
  );
}
