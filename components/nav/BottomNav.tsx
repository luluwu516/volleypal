"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Tv, Settings, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";

export interface BottomNavProps {
  isAdmin?: boolean;
  locked?: boolean;
  lockedMatchId?: string;
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
}: BottomNavProps) {
  const pathname = usePathname() || "/";
  const adminTab = locked
    ? {
        href: lockedMatchId ? `/admin/score/${lockedMatchId}` : "/admin/score",
        label: "計分",
        icon: Lock,
        match: (p: string) => p.startsWith("/admin"),
      }
    : ADMIN_TAB;
  const tabs = isAdmin ? [...TABS, adminTab] : TABS;
  const slotCount = tabs.length + 1;
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
          return (
            <li key={t.href} className="flex">
              <Link
                href={t.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <NotificationBell />
        </li>
      </ul>
    </nav>
  );
}
