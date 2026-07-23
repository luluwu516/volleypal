import { NextResponse } from "next/server";
import { z } from "zod";
import { findAdminByPin } from "@/lib/auth/pin";
import { getAdminSession } from "@/lib/auth/getSession";
import { assertSessionConfigured } from "@/lib/auth/session";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

const Body = z.object({ pin: z.string().min(4).max(32) });

/**
 * Exit referee mode. Requires the admin's PIN (re-verified against the
 * admins table) — current cookie alone is not enough so a player can't tap
 * Unlock and bypass the lock. Must match the same admin who locked the
 * session in the first place; this prevents a different admin's PIN from
 * unlocking it accidentally.
 */
export async function POST(req: Request) {
  try {
    assertSessionConfigured();
    const sess = await getAdminSession();
    if (!sess.adminId) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    const ip = clientIp(req);
    if (!(await tryRateLimit(`unlock:${ip}`, 5, 60))) {
      return NextResponse.json(
        { error: "嘗試次數過多,請稍後再試" },
        { status: 429 },
      );
    }
    const { pin } = Body.parse(await req.json());
    const admin = await findAdminByPin(pin);
    if (!admin || admin.id !== sess.adminId) {
      return NextResponse.json({ error: "PIN 不正確" }, { status: 401 });
    }
    sess.locked = false;
    sess.lockedMatchId = undefined;
    await sess.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 400 },
    );
  }
}
