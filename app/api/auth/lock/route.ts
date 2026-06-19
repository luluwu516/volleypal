import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { assertSessionConfigured } from "@/lib/auth/session";

const Body = z.object({
  matchId: z.string().uuid().optional(),
});

/**
 * Enter referee mode. Requires an active admin session. Sets `locked` flag so
 * the proxy + admin pages know to gate writes. Optional `matchId` pins scoring
 * to a single match (prevents the referee from editing other live matches).
 */
export async function POST(req: Request) {
  try {
    assertSessionConfigured();
    const sess = await getAdminSession();
    if (!sess.adminId) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    const body = req.headers.get("content-length")
      ? Body.parse(await req.json().catch(() => ({})))
      : {};
    sess.locked = true;
    if (body.matchId) sess.lockedMatchId = body.matchId;
    await sess.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 400 },
    );
  }
}
