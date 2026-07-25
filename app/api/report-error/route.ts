import { NextResponse } from "next/server";
import { z } from "zod";
import { sendAlert } from "@/lib/alert";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

// Client-side error boundaries POST here. IP-scoped rate limit (independent
// of the per-title dedup inside sendAlert) so a single malicious device can't
// spend the Resend quota.
const Body = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(4000).optional(),
  source: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  if (!(await tryRateLimit(`report-error:${clientIp(req)}`, 10, 60))) {
    return NextResponse.json({ ok: true, throttled: true });
  }
  try {
    const body = Body.parse(await req.json());
    await sendAlert({
      title: body.title,
      detail: body.detail,
      source: body.source,
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Don't leak parse errors to the client — this endpoint is best-effort.
    return NextResponse.json({ ok: true, invalid: true }, { status: 200 });
  }
}
