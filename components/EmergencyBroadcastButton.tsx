"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Megaphone, MegaphoneOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EQUIPMENT_ITEM_LABEL,
  INJURY_ITEM_LABEL,
  ISSUE_LABEL,
  type IssueKey,
} from "@/lib/emergency-broadcast/templates";

/**
 * Player-side emergency broadcast trigger. Lives in BottomNav's rightmost
 * slot on every page. Two-step Dialog:
 *
 *   1. Disclaimer view — first tap per browser session. Reminds the user
 *      this is a shared channel, that all players signed waivers, and to
 *      dial 911 for anything life-threatening. Ack persists in
 *      sessionStorage so repeat-taps in the same session skip straight to
 *      the form (real emergencies shouldn't pay the ack cost twice).
 *   2. Form view — location, issue, needed items. Location picker is
 *      dynamic on num_courts; item picker swaps based on issue.
 *
 * Client-side cooldown (10 min in localStorage per tournament) is advisory
 * only — the server holds the real limit.
 */

const ACK_KEY = "vp:emergency:ack";
const COOLDOWN_STORAGE = "vp:emergency:cooldown";
const CLIENT_COOLDOWN_MS = 10 * 60_000;

export interface EmergencyBroadcastConfig {
  tournamentId: string;
  numCourts: number;
  allowed: boolean;
}

// Persist a per-tournament cooldown deadline across refreshes. Extracted so
// useSyncExternalStore can read it without race-conditions in an effect.
function cooldownKey(tournamentId: string) {
  return `${COOLDOWN_STORAGE}:${tournamentId}`;
}
function readCooldown(tournamentId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cooldownKey(tournamentId));
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > Date.now() ? ts : null;
  } catch {
    return null;
  }
}
function subscribeCooldown(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(COOLDOWN_STORAGE)) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function EmergencyBroadcastButton({
  config,
}: {
  config: EmergencyBroadcastConfig;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ack" | "form">("ack");
  // Tracks the localStorage-persisted deadline. useSyncExternalStore keeps
  // us hydration-safe: server + first client render both return null
  // (server-safe path), a follow-up commit reads the real value once
  // window/localStorage exists. Storage-event subscription refreshes when
  // another tab clears it, and manual writes call setCooldownOverride below.
  const persistedCooldown = useSyncExternalStore(
    subscribeCooldown,
    () => readCooldown(config.tournamentId),
    () => null,
  );
  const [cooldownOverride, setCooldownOverride] = useState<number | null>(null);
  const cooldownUntil = cooldownOverride ?? persistedCooldown;
  const [now, setNow] = useState(() => Date.now());

  // 1Hz tick while cooldown is active so the button label counts down.
  // Skips when nothing is in-flight to avoid a wasted timer everywhere.
  useEffect(() => {
    if (cooldownUntil === null || cooldownUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const remaining =
    cooldownUntil && cooldownUntil > now
      ? Math.ceil((cooldownUntil - now) / 1000)
      : 0;

  function handleOpen() {
    if (!config.allowed) {
      toast.info("廣播暫停中,請直接聯絡主辦或撥打 911", { duration: 5000 });
      return;
    }
    if (remaining > 0) {
      toast.info(
        `冷卻中 (${Math.ceil(remaining / 60)} 分),若情況危急請直接呼叫主辦`,
        { duration: 5000 },
      );
      return;
    }
    // Skip disclaimer if the user has already acked in this session — first
    // tap saw it, subsequent taps go straight to the form.
    let acked = false;
    try {
      acked = sessionStorage.getItem(ACK_KEY) === "1";
    } catch {
      // no sessionStorage — always show disclaimer, which is the safer
      // default anyway.
    }
    setStep(acked ? "form" : "ack");
    setOpen(true);
  }

  function ackAndAdvance() {
    try {
      sessionStorage.setItem(ACK_KEY, "1");
    } catch {
      // ignored
    }
    setStep("form");
  }

  function handleSent(cooldownIso: string) {
    setOpen(false);
    const t = new Date(cooldownIso).getTime();
    // Local override wins immediately while localStorage settles; the
    // storage write below is best-effort so private-browsing users still
    // see the cooldown honoured within this tab.
    setCooldownOverride(t);
    setNow(Date.now());
    try {
      localStorage.setItem(cooldownKey(config.tournamentId), String(t));
    } catch {
      // ignored
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={
          !config.allowed
            ? "緊急廣播 (暫停中)"
            : remaining > 0
              ? `緊急廣播 (冷卻 ${Math.ceil(remaining / 60)} 分)`
              : "緊急廣播"
        }
        className={
          "relative flex-1 flex items-center justify-center py-4 transition-colors " +
          (!config.allowed || remaining > 0
            ? "text-muted-foreground/60"
            : "text-red-400 hover:text-red-300")
        }
      >
        <span className="relative">
          {/* Swap to the lucide `MegaphoneOff` (slashed) icon when the
              feature is either disabled by the kill switch or on client
              cooldown. Grayscale alone was hard to read at a glance —
              the slash makes "can't tap right now" unambiguous. */}
          {!config.allowed || remaining > 0 ? (
            <MegaphoneOff className="size-6" />
          ) : (
            <Megaphone className="size-6" />
          )}
        </span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false);
            // Reset to whichever step the next open should start on. Keep
            // acked state — that's session-scoped, not per-dialog.
            setStep("ack");
          }
        }}
      >
        <DialogContent className="border-red-500/50">
          {step === "ack" ? (
            <DisclaimerStep
              onAck={ackAndAdvance}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <FormStep
              config={config}
              onSent={handleSent}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DisclaimerStep({
  onAck,
  onCancel,
}: {
  onAck: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-red-400" />
        <DialogTitle className="text-red-100">緊急廣播提醒</DialogTitle>
      </div>
      <DialogDescription asChild>
        <div className="text-sm leading-relaxed space-y-2 text-foreground/90">
          <p>
            此功能會將訊息即時發送給所有正在使用 App 的球員,請
            <span className="text-red-300 font-semibold">
              僅在真的需要幫助時使用
            </span>
            ,避免佔用廣播頻道。
          </p>
          <p>
            所有球員皆已簽署 waiver,主辦方不承擔醫療責任。
            <span className="text-red-300 font-semibold">
              若遇危急狀況請直接撥打 911。
            </span>
          </p>
        </div>
      </DialogDescription>
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          取消
        </Button>
        <Button
          type="button"
          onClick={onAck}
          className="flex-1 bg-red-500 hover:bg-red-500/90 text-white"
        >
          我知道了
        </Button>
      </div>
    </div>
  );
}

function FormStep({
  config,
  onSent,
  onCancel,
}: {
  config: EmergencyBroadcastConfig;
  onSent: (cooldownIso: string) => void;
  onCancel: () => void;
}) {
  const searchParams = useSearchParams();

  // Location key list: dynamic courts + fixed extras.
  const locations = useMemo(() => {
    const courtItems = Array.from({ length: config.numCourts }, (_, i) => ({
      key: `court_${i + 1}`,
      label: `場地${i + 1}`,
    }));
    return [
      ...courtItems,
      { key: "sideline", label: "場邊" },
      { key: "entrance", label: "入口處" },
      { key: "other", label: "其他" },
    ];
  }, [config.numCourts]);

  // Pre-select court from ?court= if present (Live page passes it) so the
  // player doesn't have to re-pick their court in an emergency.
  const initialLocation = useMemo(() => {
    const raw = searchParams?.get("court");
    if (!raw) return null;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= config.numCourts) {
      return `court_${n}`;
    }
    return null;
  }, [searchParams, config.numCourts]);

  const [locationKey, setLocationKey] = useState<string | null>(initialLocation);
  const [locationOther, setLocationOther] = useState("");
  const [issue, setIssue] = useState<IssueKey | null>(null);
  const [items, setItems] = useState<Set<string>>(new Set());
  const [itemOther, setItemOther] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemChoices =
    issue === "equipment"
      ? EQUIPMENT_ITEM_LABEL
      : issue === "injury"
        ? INJURY_ITEM_LABEL
        : null;

  function toggleItem(key: string) {
    setItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function pickIssue(k: IssueKey) {
    // Switching issue must clear items — the item picker's key namespace
    // changes and a stale key would silently drop server-side.
    setIssue(k);
    setItems(new Set());
    setItemOther("");
  }

  const canSend =
    !sending &&
    locationKey !== null &&
    issue !== null &&
    items.size > 0 &&
    (locationKey !== "other" || locationOther.trim().length > 0) &&
    (!items.has("other") || itemOther.trim().length > 0);

  async function submit() {
    if (!canSend || !issue || !locationKey) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/emergency-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament_id: config.tournamentId,
          issue,
          location_key: locationKey,
          location_other: locationKey === "other" ? locationOther : null,
          item_keys: Array.from(items),
          item_other: items.has("other") ? itemOther : null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        cooldown_until?: string;
        downgraded?: boolean;
      };
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      toast.success(
        j.downgraded
          ? "已送出 (近期廣播已多次,以一般公告顯示)"
          : "已送出緊急廣播",
        { duration: 5000 },
      );
      onSent(
        j.cooldown_until ?? new Date(Date.now() + CLIENT_COOLDOWN_MS).toISOString(),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogTitle className="flex items-center gap-2 text-red-100">
        <Megaphone className="size-5 text-red-400" />
        緊急廣播
      </DialogTitle>
      <DialogDescription className="sr-only">
        發送緊急廣播給所有球員
      </DialogDescription>

      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          在哪裡?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {locations.map((l) => (
            <Chip
              key={l.key}
              selected={locationKey === l.key}
              onClick={() => setLocationKey(l.key)}
            >
              {l.label}
            </Chip>
          ))}
        </div>
        {locationKey === "other" && (
          <Input
            value={locationOther}
            onChange={(e) => setLocationOther(e.target.value)}
            placeholder="例:停車場、洗手間"
            maxLength={40}
            className="mt-2"
            autoFocus
          />
        )}
      </section>

      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          發生什麼事?
        </p>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(ISSUE_LABEL) as IssueKey[]).map((k) => (
            <Chip
              key={k}
              selected={issue === k}
              onClick={() => pickIssue(k)}
              className="w-full"
            >
              {ISSUE_LABEL[k]}
            </Chip>
          ))}
        </div>
      </section>

      {itemChoices && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            需要什麼? (可複選)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(itemChoices).map(([k, label]) => (
              <Chip
                key={k}
                selected={items.has(k)}
                onClick={() => toggleItem(k)}
              >
                {label}
              </Chip>
            ))}
          </div>
          {items.has("other") && (
            <Input
              value={itemOther}
              onChange={(e) => setItemOther(e.target.value)}
              placeholder="例: 膠帶、止痛藥、繃帶"
              maxLength={40}
              className="mt-2"
            />
          )}
        </section>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={sending}
          className="flex-1"
        >
          取消
        </Button>
        <Button
          type="submit"
          disabled={!canSend}
          className="flex-1 bg-red-500 hover:bg-red-500/90 text-white disabled:opacity-40"
        >
          {sending ? "發送中…" : "發送廣播"}
        </Button>
      </div>
    </form>
  );
}

function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        (className ? className + " " : "") +
        "rounded-md border px-3 min-h-9 text-sm transition-colors " +
        (selected
          ? "bg-red-500/20 border-red-500/60 text-red-100"
          : "bg-transparent border-border/60 text-foreground hover:bg-white/5")
      }
    >
      {children}
    </button>
  );
}
