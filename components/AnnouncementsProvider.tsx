"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Announcement } from "@/lib/db/types";

const STORAGE_KEY = "volleypal-dismissed-announcements";
const STORAGE_EVENT = "volleypal:dismissed-changed";
const POLL_MS = 30_000;
const EMPTY_DISMISSED = new Set<string>();

function readDismissedRaw(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseDismissed(raw: string): Set<string> {
  if (!raw) return EMPTY_DISMISSED;
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return EMPTY_DISMISSED;
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    // localStorage unavailable (private mode) — skip persistence
  }
}

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(STORAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isExpired(a: Announcement): boolean {
  return Boolean(a.expires_at && new Date(a.expires_at).getTime() <= Date.now());
}

interface AnnouncementsContextValue {
  items: Announcement[];
  dismissed: Set<string>;
  unreadCount: number;
  dismiss: (id: string) => void;
  markAllRead: () => void;
  isDismissed: (id: string) => boolean;
}

const AnnouncementsContext = createContext<AnnouncementsContextValue | null>(
  null,
);

interface ProviderProps {
  initial: Announcement[];
  children: ReactNode;
}

/**
 * Single source of truth for announcement data + dismissed state.
 * - Polls /api/announcements every 30s.
 * - dismissed IDs live in localStorage, synced across the component tree via
 *   useSyncExternalStore so AnnouncementCenter and NotificationBell stay in lock-step.
 */
export function AnnouncementsProvider({ initial, children }: ProviderProps) {
  const [items, setItems] = useState<Announcement[]>(initial);

  const dismissedRaw = useSyncExternalStore(
    subscribeDismissed,
    readDismissedRaw,
    () => "",
  );
  const dismissed = parseDismissed(dismissedRaw);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/announcements", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { announcements: Announcement[] };
        if (!cancelled) setItems(data.announcements ?? []);
      } catch {
        // network blip — try again on next tick
      }
    };
    const id = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const next = new Set(parseDismissed(readDismissedRaw()));
    next.add(id);
    writeDismissed(next);
  }, []);

  const markAllRead = useCallback(() => {
    const next = new Set(parseDismissed(readDismissedRaw()));
    for (const a of items) {
      if (!isExpired(a)) next.add(a.id);
    }
    writeDismissed(next);
  }, [items]);

  const visibleItems = items.filter((a) => !isExpired(a));
  const unreadCount = visibleItems.filter((a) => !dismissed.has(a.id)).length;

  return (
    <AnnouncementsContext.Provider
      value={{
        items: visibleItems,
        dismissed,
        unreadCount,
        dismiss,
        markAllRead,
        isDismissed: (id) => dismissed.has(id),
      }}
    >
      {children}
    </AnnouncementsContext.Provider>
  );
}

export function useAnnouncements(): AnnouncementsContextValue {
  const ctx = useContext(AnnouncementsContext);
  if (!ctx) {
    throw new Error(
      "useAnnouncements must be used within AnnouncementsProvider",
    );
  }
  return ctx;
}
