/**
 * Format timestamps in the app's display timezone (default America/Los_Angeles).
 * Used in BOTH server and client components — server components on Vercel run
 * in UTC by default, so `toLocaleTimeString()` without a timeZone option will
 * silently render UTC time on the server vs local time in the browser.
 * Always go through these helpers to keep displays consistent.
 */

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}
