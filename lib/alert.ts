import { createHash } from "node:crypto";
import { Resend } from "resend";
import { env, isAlertingEnabled } from "./env";
import { tryRateLimit } from "./rateLimit";

// Small alerting helper. Sends an email via Resend when a "something bad
// happened" event fires. Deduped by message hash for a 10-minute window
// so one crash doesn't fan out into 100 identical emails from every device.

let resend: Resend | null = null;
function client(): Resend | null {
  if (!isAlertingEnabled()) return null;
  if (!resend) resend = new Resend(env().RESEND_API_KEY!);
  return resend;
}

export interface AlertPayload {
  /** Short one-line subject. Also used for dedup. */
  title: string;
  /** Longer body. Include stack traces, request info, etc. */
  detail?: string;
  /** Where this fired — "client:error-boundary", "server:api:score", etc. */
  source: string;
}

/**
 * Fire-and-forget alert. Never throws — alerting failures should not cascade
 * into the caller's own error path. Silently no-ops when alerting isn't
 * configured (RESEND_API_KEY / ALERT_EMAIL_* missing).
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const c = client();
  if (!c) return;

  try {
    // Dedup: same title within 10 min = one email, not 100.
    const hash = createHash("sha1")
      .update(payload.title)
      .digest("hex")
      .slice(0, 12);
    if (!(await tryRateLimit(`alert:${hash}`, 1, 600))) {
      return;
    }

    const e = env();
    await c.emails.send({
      from: e.ALERT_EMAIL_FROM!,
      to: e.ALERT_EMAIL_TO!,
      subject: `[VolleyPal] ${payload.title}`,
      text: [
        `Source: ${payload.source}`,
        `Time:   ${new Date().toISOString()}`,
        "",
        payload.detail ?? "(no detail)",
      ].join("\n"),
    });
  } catch (err) {
    // Alerting is best-effort. Log to Vercel console but do not throw.
    console.error("sendAlert failed", err);
  }
}
