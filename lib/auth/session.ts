import type { SessionOptions } from "iron-session";

export interface AdminSession {
  adminId: string;
  adminName: string;
  loggedInAt: number;
  // Referee-mode lock. When true, server blocks non-scoring admin writes and
  // client renders admin pages with controls disabled. Unlocked via PIN re-entry.
  locked?: boolean;
  // Optional pin-to-match — restricts scoring to a specific matchId when set.
  lockedMatchId?: string;
}

export const sessionOptions: SessionOptions = {
  cookieName: "volleypal_admin",
  password: process.env.SESSION_COOKIE_SECRET || "",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // 24h — one tournament day. Shorter TTL narrows the window if the
    // device gets left behind or picked up by someone after the event.
    maxAge: 60 * 60 * 24,
  },
};

export function assertSessionConfigured() {
  if (!process.env.SESSION_COOKIE_SECRET || process.env.SESSION_COOKIE_SECRET.length < 32) {
    throw new Error(
      "SESSION_COOKIE_SECRET is missing or too short (need 32+ chars). " +
        "Generate with `openssl rand -hex 32`.",
    );
  }
}
