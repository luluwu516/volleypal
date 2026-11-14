"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { GroupingStrategy, Tournament } from "@/lib/db/types";
import {
  MIXED_COUNTERPART,
  clampGroupRounds,
  clampTeamCount,
  describeShape,
  minSlotCount,
  refereeCoverage,
  teamCountOptions,
  teamCountSupported,
  tournamentShape,
} from "@/lib/tournamentFormat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OptionListEditor } from "@/components/admin/OptionListEditor";

// Hints take the configured team count rather than spelling 8, which is the
// whole point of the size setting. The two 同* strategies don't: they really
// are 4 attributes × 2 halves and can't be anything else.
const STRATEGY_OPTIONS: {
  value: GroupingStrategy;
  label: string;
  hint: (numTeams: number) => string;
}[] = [
  { value: "zodiac_together", label: "同星座象", hint: () => "火/土/風/水 各成兩隊,固定 8 隊" },
  { value: "zodiac_mixed", label: "打散各星座象", hint: (n) => `${n} 隊各自混合星座` },
  { value: "mbti_together", label: "同 MBTI 氣質", hint: () => "NF/NT/SJ/SP 各成兩隊,固定 8 隊" },
  { value: "mbti_mixed", label: "打散各 MBTI 氣質", hint: (n) => `${n} 隊各自混合氣質` },
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
  const [numTeams, setNumTeams] = useState(
    clampTeamCount(tournament.num_teams),
  );
  const [groupRounds, setGroupRounds] = useState(
    clampGroupRounds(tournament.group_rounds),
  );
  const [skipSilverBracket, setSkipSilverBracket] = useState(
    tournament.skip_silver_bracket,
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
  const [skipThird, setSkipThird] = useState(tournament.skip_third_place);
  const [skipSilverThird, setSkipSilverThird] = useState(
    tournament.skip_silver_third_place,
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
    numTeams !== clampTeamCount(tournament.num_teams) ||
    groupRounds !== clampGroupRounds(tournament.group_rounds) ||
    skipSilverBracket !== tournament.skip_silver_bracket ||
    numCourts !== tournament.num_courts ||
    matchDuration !== tournament.match_duration_min ||
    groupTimeLimit !== (tournament.group_stage_time_limit_min ?? 0) ||
    maxActive !== tournament.max_active_participants ||
    maxNonTw !== tournament.max_non_taiwanese ||
    allowBroadcast !== tournament.allow_player_broadcast ||
    skipThird !== tournament.skip_third_place ||
    skipSilverThird !== tournament.skip_silver_third_place ||
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

  // Resizing can rule the current strategy out: 同星座象 is 4 attributes × 2
  // halves, so it only ever makes 8 teams. Switch to its mixed counterpart
  // rather than leaving a combination that would fail at 一鍵分隊 — same
  // attribute, spread across the teams instead of shared within them. Toasted
  // because silently changing a setting the admin chose is worse than the
  // combination it prevents.
  function changeNumTeams(n: number) {
    setNumTeams(n);
    if (!teamCountSupported(strategy, n)) {
      const next = MIXED_COUNTERPART[strategy];
      setStrategy(next);
      const label =
        STRATEGY_OPTIONS.find((o) => o.value === next)?.label ?? next;
      toast.info(`分隊策略已改為「${label}」`, {
        description: `原本的策略固定產生 8 隊,做不出 ${n} 隊。`,
      });
    }
  }

  // Shape of the event as currently configured — drives the placement
  // toggles' labels, since which match "the last lower-bracket game" is
  // depends on the group size.
  const shapeNow = tournamentShape({
    numTeams,
    groupRounds,
    skipThirdPlace: skipThird,
    skipSilverBracket,
    skipSilverThirdPlace: skipSilverThird,
  });
  const silverBracketOff = shapeNow.lowerBracket === "none";
  const lastSilverLabel =
    shapeNow.lowerBracket === "single" ? "5-6" : "7-8";

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
          num_teams: numTeams,
          group_rounds: groupRounds,
          skip_silver_bracket: skipSilverBracket,
          num_courts: numCourts,
          match_duration_min: matchDuration,
          group_stage_time_limit_min: groupTimeLimit || null,
          max_active_participants: maxActive,
          max_non_taiwanese: maxNonTw,
          allow_player_broadcast: allowBroadcast,
          skip_third_place: skipThird,
          skip_silver_third_place: skipSilverThird,
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
        <TournamentSizeSection
          numTeams={numTeams}
          onNumTeams={changeNumTeams}
          groupRounds={groupRounds}
          onGroupRounds={setGroupRounds}
          numCourts={numCourts}
          matchDuration={matchDuration}
          skipThird={skipThird}
          skipSilverBracket={skipSilverBracket}
          skipSilverThird={skipSilverThird}
          strategy={strategy}
        />

        {/* After 賽事規模, not before: the strategy is constrained by the
            team count, so the number it depends on should already be on
            screen and the two should sit together. */}
        <div>
          <Label htmlFor="strategy">分隊策略</Label>
          <select
            id="strategy"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as GroupingStrategy)}
          >
            {STRATEGY_OPTIONS.map((o) => {
              const usable = teamCountSupported(o.value, numTeams);
              return (
                <option key={o.value} value={o.value} disabled={!usable}>
                  {o.label} · {o.hint(numTeams)}
                  {usable ? "" : `（做不出 ${numTeams} 隊）`}
                </option>
              );
            })}
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
            淘汰賽名次戰
          </p>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipThird}
                onChange={(e) => setSkipThird(e.target.checked)}
                className="size-5 mt-0.5 rounded border-input accent-emerald-500 shrink-0"
              />
              <span className="flex-1">
                <span className="text-sm font-medium">不打季軍賽</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  兩隊準決賽落敗方並列第 3。下次生成賽程時套用。
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipSilverBracket}
                onChange={(e) => setSkipSilverBracket(e.target.checked)}
                className="size-5 mt-0.5 rounded border-input accent-emerald-500 shrink-0"
              />
              <span className="flex-1">
                <span className="text-sm font-medium">不打排位賽</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  完全不排 5 名以後的淘汰賽,名次直接看小組戰績。場地時間最吃緊時用。
                </span>
              </span>
            </label>
            {/* Moot once the whole lower bracket is off, so it goes dead
                rather than silently doing nothing. Its label follows the
                shape: with groups of 4+ the last lower-bracket game is 7-8,
                with groups of 3 it's the 5-6 game itself. */}
            <label
              className={`flex items-start gap-2 ${
                silverBracketOff ? "opacity-40" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={skipSilverThird}
                disabled={silverBracketOff}
                onChange={(e) => setSkipSilverThird(e.target.checked)}
                className="size-5 mt-0.5 rounded border-input accent-emerald-500 shrink-0"
              />
              <span className="flex-1">
                <span className="text-sm font-medium">
                  不打 {lastSilverLabel} 名戰
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {silverBracketOff
                    ? "已關閉整個排位賽,此項無作用。"
                    : shapeNow.lowerBracket === "single"
                      ? "兩組第 3 名並列第 5。下次生成賽程時套用。"
                      : "5-8 名準決賽兩隊落敗方並列第 7。下次生成賽程時套用。"}
                </span>
              </span>
            </label>
          </div>
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

/**
 * Tournament SIZE — how many teams and how many group rounds. Deliberately
 * separate from the 淘汰賽名次戰 section below: this decides the shape of the
 * event, that decides which optional matches get played. They were briefly
 * the same setting (a "format" enum with entries like "8 teams, gold only"),
 * which both duplicated the placement toggles and meant a new enum value and
 * a migration every time a roster was a different size.
 *
 * The live readout is the part that gets used: the reason to resize
 * mid-crisis is almost always the venue booking, and that's the number being
 * checked against it.
 */
function TournamentSizeSection({
  numTeams,
  onNumTeams,
  groupRounds,
  onGroupRounds,
  numCourts,
  matchDuration,
  skipThird,
  skipSilverBracket,
  skipSilverThird,
  strategy,
}: {
  numTeams: number;
  onNumTeams: (n: number) => void;
  groupRounds: number;
  onGroupRounds: (n: number) => void;
  numCourts: number;
  matchDuration: number;
  skipThird: boolean;
  skipSilverBracket: boolean;
  skipSilverThird: boolean;
  strategy: GroupingStrategy;
}) {
  const shape = tournamentShape({
    numTeams,
    groupRounds,
    skipThirdPlace: skipThird,
    skipSilverBracket,
    skipSilverThirdPlace: skipSilverThird,
  });
  const slots = minSlotCount(shape, numCourts);
  const refs = refereeCoverage(numTeams, numCourts);
  // The *_together strategies bucket by 4 attributes and halve each bucket,
  // so they're structurally 8 teams. Flag it here rather than letting 一鍵分隊
  // fail later — that failure would land on match day.
  const strategyClashes =
    numTeams !== 8 &&
    (strategy === "zodiac_together" || strategy === "mbti_together");

  return (
    <div className="border-t border-border/40 pt-2">
      <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wider">
        賽事規模
      </p>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="numteams">隊伍數</Label>
            <select
              id="numteams"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              value={numTeams}
              onChange={(e) => onNumTeams(Number(e.target.value))}
            >
              {teamCountOptions().map((n) => (
                <option key={n} value={n}>
                  {n} 隊（兩組各 {n / 2}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="grouprounds">小組循環</Label>
            <select
              id="grouprounds"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              value={groupRounds}
              onChange={(e) => onGroupRounds(Number(e.target.value))}
            >
              <option value={1}>單循環</option>
              <option value={2}>雙循環</option>
            </select>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {describeShape(shape)}
        </p>

        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
          <span>
            總場數 <span className="font-semibold">{shape.totalMatches}</span>
          </span>
          <span>
            時段 <span className="font-semibold">{slots}</span>
          </span>
          <span>
            佔用場地時間{" "}
            <span className="font-semibold">
              {formatSpan(slots * matchDuration)}
            </span>
          </span>
          <span className="w-full text-muted-foreground text-[11px]">
            以 {numCourts} 個場地、每場 {matchDuration} 分計。預賽排程還有「不連續
            兩場」的休息限制,實際可能再多一個時段。
          </span>
        </div>

        {!refs.ok && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            ⚠ 同時開 {refs.concurrent} 場會用掉 {refs.playing} 隊,只剩{" "}
            {refs.resting} 隊能當裁判,但需要 {refs.concurrent} 隊。部分預賽會排
            不到裁判(賽程的裁判欄會是空的),要現場自己找人。
            {numTeams} 隊最多用 {refs.maxCourts} 個場地;
            {numCourts} 個場地需要 ≥ {refs.minTeams} 隊。
          </p>
        )}

        {strategyClashes && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            ⚠ 目前的分隊策略固定產生 8 隊,無法分成 {numTeams} 隊。
            請把分隊策略改成「打散各星座象」或「打散各 MBTI 氣質」,否則一鍵分隊會失敗。
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">
          改隊伍數後要重新「一鍵分隊」再「產生賽程」才會套用 ——
          兩者都會清掉現有的隊伍和未完成的賽程。
        </p>
      </div>
    </div>
  );
}


/** "3 小時 30 分" from a minute count; drops the hours part under an hour. */
function formatSpan(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分`;
  return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}
