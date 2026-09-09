"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { GroupingStrategy, Tournament } from "@/lib/db/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OptionListEditor } from "@/components/admin/OptionListEditor";

const STRATEGY_OPTIONS: { value: GroupingStrategy; label: string; hint: string }[] = [
  { value: "zodiac_together", label: "同星座象", hint: "火/土/風/水 各成兩隊" },
  { value: "zodiac_mixed", label: "打散各星座象", hint: "8 隊各自混合星座" },
  { value: "mbti_together", label: "同 MBTI 氣質", hint: "NF/NT/SJ/SP 各成兩隊" },
  { value: "mbti_mixed", label: "打散各 MBTI 氣質", hint: "8 隊各自混合氣質" },
];

interface Props {
  tournament: Tournament;
  disabled?: boolean;
}

export function TournamentSettingsForm({ tournament, disabled = false }: Props) {
  const router = useRouter();
  const [name, setName] = useState(tournament.name);
  const [year, setYear] = useState(tournament.year);
  const [strategy, setStrategy] = useState<GroupingStrategy>(
    tournament.grouping_strategy,
  );
  const [numCourts, setNumCourts] = useState(tournament.num_courts);
  const [matchDuration, setMatchDuration] = useState(
    tournament.match_duration_min,
  );
  const [groupTimeLimit, setGroupTimeLimit] = useState(
    tournament.group_stage_time_limit_min ?? 0,
  );
  const [maxActive, setMaxActive] = useState(tournament.max_active_participants);
  const [maxNonTw, setMaxNonTw] = useState(tournament.max_non_taiwanese);
  const [allowBroadcast, setAllowBroadcast] = useState(
    tournament.allow_player_broadcast,
  );
  const [rulesUrl, setRulesUrl] = useState(tournament.rules_doc_url ?? "");
  const [regUrl, setRegUrl] = useState(tournament.registration_form_url ?? "");
  const [waiverUrl, setWaiverUrl] = useState(tournament.waiver_url ?? "");
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

  // Any field diverging from the row we rendered from is a dirty edit.
  // Drives the badge next to the Save button plus the disabled state so
  // admins can tell at a glance whether Save has anything to do.
  const dirty =
    name !== tournament.name ||
    year !== tournament.year ||
    strategy !== tournament.grouping_strategy ||
    numCourts !== tournament.num_courts ||
    matchDuration !== tournament.match_duration_min ||
    groupTimeLimit !== (tournament.group_stage_time_limit_min ?? 0) ||
    maxActive !== tournament.max_active_participants ||
    maxNonTw !== tournament.max_non_taiwanese ||
    allowBroadcast !== tournament.allow_player_broadcast ||
    rulesUrl !== (tournament.rules_doc_url ?? "") ||
    regUrl !== (tournament.registration_form_url ?? "") ||
    waiverUrl !== (tournament.waiver_url ?? "") ||
    address !== (tournament.venue_address ?? "") ||
    transport !== (tournament.venue_transport ?? "") ||
    lunch !== (tournament.venue_lunch_options ?? "") ||
    drink !== (tournament.venue_drink_options ?? "") ||
    dinnerName !== (tournament.dinner_venue_name ?? "") ||
    dinnerAddress !== (tournament.dinner_venue_address ?? "") ||
    nearby !== (tournament.venue_nearby ?? "");

  async function save() {
    if (maxNonTw > maxActive) {
      toast.error("非台灣配額不能超過總人數上限");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tournament/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          year,
          grouping_strategy: strategy,
          num_courts: numCourts,
          match_duration_min: matchDuration,
          group_stage_time_limit_min: groupTimeLimit || null,
          max_active_participants: maxActive,
          max_non_taiwanese: maxNonTw,
          allow_player_broadcast: allowBroadcast,
          rules_doc_url: rulesUrl || null,
          registration_form_url: regUrl || null,
          waiver_url: waiverUrl || null,
          venue_address: address || null,
          venue_transport: transport || null,
          venue_lunch_options: lunch || null,
          venue_drink_options: drink || null,
          dinner_venue_name: dinnerName || null,
          dinner_venue_address: dinnerAddress || null,
          venue_nearby: nearby || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Save failed");
      }
      toast.success("已儲存");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    // Wrapper div bounds the sticky save button's containing block so it
    // stops floating exactly when scrolled past the Card — the export
    // section below is a sibling of this wrapper, safe from overlap.
    <div className="flex flex-col gap-3">
    {/* gap-2 + py-3 override the shadcn Card defaults (gap-6 + py-6) so
        this form fits an iPhone SE viewport with less scrolling. */}
    <Card className="gap-2 py-3">
      <CardHeader className="pb-1">
        <CardTitle className="text-base">
          {tournament.name} · {tournament.year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset
          disabled={disabled}
          className="flex flex-col gap-3 min-w-0 disabled:opacity-60 group"
        >
        <div>
          <Label htmlFor="name">賽事名稱</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div>
          <Label htmlFor="year">賽事年份</Label>
          <Input
            id="year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="strategy">分隊策略</Label>
          <select
            id="strategy"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as GroupingStrategy)}
          >
            {STRATEGY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} · {o.hint}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            決定「產生隊伍」按鈕背後的分組演算法。改動後下次生成才會套用。
          </p>
        </div>
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

        <div className="border-t border-border/40 pt-2">
          <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wider">
            報名人數上限
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="maxActive">總球員數上限</Label>
              <Input
                id="maxActive"
                type="number"
                min={8}
                max={200}
                value={maxActive}
                onChange={(e) => setMaxActive(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="maxNonTw">非台灣人上限</Label>
              <Input
                id="maxNonTw"
                type="number"
                min={0}
                max={maxActive}
                value={maxNonTw}
                onChange={(e) => setMaxNonTw(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                硬上限 — 超過就進候補,不管台灣人有沒有滿。台灣人補足剩下的名額。
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 pt-2">
          <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wider">
            緊急廣播
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowBroadcast}
              onChange={(e) => setAllowBroadcast(e.target.checked)}
              className="size-5 mt-0.5 rounded border-input accent-emerald-500 shrink-0"
            />
            <span className="flex-1">
              <span className="text-sm font-medium">
                開放球員緊急廣播
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                球員可從 App 底部 🚨 送出「缺器材 / 有人受傷」廣播。關閉後
                新的廣播被擋,已發出的廣播照原本流程過期或手動刪除。
              </span>
            </span>
          </label>
        </div>

        <div className="border-t border-border/40 pt-2">
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
            <div>
              <Label htmlFor="waiver">場館 Waiver URL</Label>
              <Input
                id="waiver"
                type="url"
                placeholder="https://forms.gle/... 或 PDF 連結"
                value={waiverUrl}
                onChange={(e) => setWaiverUrl(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 pt-2">
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
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
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
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
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
                placeholder="例如:旁邊 7-11,急救藥局在轉角"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 pt-2">
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
                placeholder="例如:鼎泰豐"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div>
              <Label htmlFor="dinnerAddr">晚餐餐廳地址（用於導航）</Label>
              <Input
                id="dinnerAddr"
                value={dinnerAddress}
                onChange={(e) => setDinnerAddress(e.target.value)}
                placeholder="例如:1108 S Baldwin Ave, Arcadia, CA 91007"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div>
              <Label>午餐選擇</Label>
              <OptionListEditor
                value={lunch}
                onChange={setLunch}
                namePlaceholder="例如 Chick-fil-A"
              />
            </div>
            <div>
              <Label>飲料選擇</Label>
              <OptionListEditor
                value={drink}
                onChange={setDrink}
                namePlaceholder="例如 TP Tea"
              />
            </div>
          </div>
        </div>

        </fieldset>
      </CardContent>
    </Card>

    {/* Floating save bar — mirrors the pattern used by 一鍵分隊 on
        /admin/teams. Sticks above BottomNav (≈4rem) + safe-area, and
        stops naturally at the wrapper div's bottom so the JSON/CSV
        export section below never gets covered. */}
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-sm py-2 -mx-4 px-4 border-t border-border/30 flex items-center gap-2">
      <Button
        onClick={save}
        disabled={busy || !dirty || disabled}
        className="flex-1"
      >
        {busy ? "儲存中…" : "儲存"}
      </Button>
      {dirty && !busy && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-1 text-[11px] text-amber-200">
          <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
          有未儲存變更
        </span>
      )}
    </div>
    </div>
  );
}
