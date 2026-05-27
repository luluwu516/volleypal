import type { SessionOptions } from "iron-session";

export interface AdminSession {
  adminId: string;
  adminName: string;
  loggedInAt: number;
}

export const sessionOptions: SessionOptions = {
  cookieName: "volleypal_admin",
  password: process.env.SESSION_COOKIE_SECRET || "",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
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
