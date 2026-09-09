"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

/**
 * Sticky top bar. One row, one job: identify the current view and expose the
 * global announcement bell.
 *
 * Home shows the app name (long-press admin login stays on the Hero in the
 * body, unchanged). Tab-level pages (Ranking, Live, Admin landing) show
 * their h1 here so the page body can drop it. Drill-down pages get a Back
 * link scoped to their parent — public pages back to `/`, admin pages back
 * to `/admin`, with per-route overrides where the parent isn't the landing
 * (e.g. `/admin/score/[matchId]` → `/admin/score`).
 */

type HeaderConfig =
  | { kind: "app"; label: string }
  | { kind: "title"; title: string }
  | { kind: "back"; href: string; label: string };

const ROUTES: Array<{ match: (p: string) => boolean; config: HeaderConfig }> = [
  { match: (p) => p === "/", config: { kind: "app", label: "VolleyPal" } },
  {
    match: (p) => p.startsWith("/ranking"),
    config: { kind: "title", title: "戰績 & 賽程" },
  },
  {
    match: (p) => p.startsWith("/live"),
    config: { kind: "title", title: "即時比分" },
  },
  {
    match: (p) => p === "/teams",
    config: { kind: "back", href: "/", label: "首頁" },
  },
  {
    match: (p) => p === "/admin",
    config: { kind: "title", title: "Admin" },
  },
  {
    match: (p) => p === "/admin/login",
    config: { kind: "title", title: "登入" },
  },
  {
    // /admin/score/[matchId] → back to score list, not admin landing.
    match: (p) => /^\/admin\/score\/[^/]+$/.test(p),
    config: { kind: "back", href: "/admin/score", label: "挑場比賽" },
  },
  {
    match: (p) => p.startsWith("/admin/"),
    config: { kind: "back", href: "/admin", label: "Admin" },
  },
];

// Fallback for any public route not enumerated above: back to home.
const DEFAULT: HeaderConfig = { kind: "back", href: "/", label: "首頁" };

function resolveConfig(pathname: string): HeaderConfig {
  return ROUTES.find((r) => r.match(pathname))?.config ?? DEFAULT;
}

export function AppHeader() {
  const pathname = usePathname() || "/";
  const config = resolveConfig(pathname);
  return (
    <header
      // Sticky (not fixed) so the header participates in normal document
      // flow — content below starts *below* the header without needing a
      // manual padding-top. Banners in AnnouncementCenter still need an
      // explicit offset because they're position:fixed.
      className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-md backdrop-saturate-150"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className="mx-auto flex w-full max-w-md items-center justify-between gap-2 h-12"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        <div className="min-w-0 flex-1">
          {config.kind === "app" && (
            <span className="text-base font-semibold tracking-tight">
              {config.label}
            </span>
          )}
          {config.kind === "title" && (
            <h1 className="text-base font-semibold tracking-tight truncate">
              {config.title}
            </h1>
          )}
          {config.kind === "back" && (
            <Link
              href={config.href}
              className="inline-flex items-center gap-1 -ml-1 px-1 min-h-9 text-sm text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-4 shrink-0" />
              {/* Hide the label on very narrow screens — the arrow alone is
                  enough affordance, and cramped label + bell fights layout. */}
              <span className="truncate max-[340px]:sr-only">{config.label}</span>
            </Link>
          )}
        </div>
        <div className="shrink-0">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
