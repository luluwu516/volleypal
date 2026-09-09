"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Tv, Settings, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EmergencyBroadcastButton,
  type EmergencyBroadcastConfig,
} from "@/components/EmergencyBroadcastButton";

const LIVE_POLL_MS = 15_000;

function useHasLiveMatch() {
  const [hasLive, setHasLive] = useState(false);
  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/live-status", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { hasLive?: boolean };
        if (alive) setHasLive(Boolean(j.hasLive));
      } catch {
        // network blip — keep last-known value
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, LIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return hasLive;
}

export interface BottomNavProps {
  isAdmin?: boolean;
  locked?: boolean;
  lockedMatchId?: string;
  // Present when a tournament is loaded — enables the rightmost emergency
  // broadcast slot. Absent (null) → the slot is hidden entirely so pre-
  // setup / setup-error states don't render a broken button.
  emergency?: EmergencyBroadcastConfig | null;
}

const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/ranking",
    label: "Ranking",
    icon: Trophy,
    match: (p: string) => p.startsWith("/ranking"),
  },
  {
    href: "/live",
    label: "Live",
    icon: Tv,
    match: (p: string) => p.startsWith("/live"),
  },
];

const ADMIN_TAB = {
  href: "/admin",
  label: "Admin",
  icon: Settings,
  match: (p: string) => p.startsWith("/admin"),
};

export function BottomNav({
  isAdmin = false,
  locked = false,
  lockedMatchId,
  emergency = null,
}: BottomNavProps) {
  const pathname = usePathname() || "/";
  const hasLive = useHasLiveMatch();
  const adminTab = locked
    ? {
        href: lockedMatchId ? `/admin/score/${lockedMatchId}` : "/admin/score",
        label: "計分",
        icon: Lock,
        match: (p: string) => p.startsWith("/admin"),
      }
    : ADMIN_TAB;
  const tabs = isAdmin ? [...TABS, adminTab] : TABS;
  const slotCount = tabs.length + (emergency ? 1 : 0);
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border/40 bg-background/60 backdrop-blur-md backdrop-saturate-150"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        className="grid mx-auto max-w-md"
        style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          const showLiveDot = t.href === "/live" && hasLive;
          return (
            <li key={t.href} className="flex">
              <Link
                href={t.href}
                aria-label={
                  showLiveDot ? `${t.label},有比賽進行中` : t.label
                }
                className={cn(
                  "flex-1 flex items-center justify-center py-4 transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-6" />
                  {showLiveDot && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                      <span className="absolute inline-flex size-full rounded-full bg-red-500 opacity-75 animate-ping" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
        {emergency && (
          <li className="flex">
            <EmergencyBroadcastButton config={emergency} />
          </li>
        )}
      </ul>
    </nav>
  );
}
