import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findAdminByPin } from "@/lib/auth/pin";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

const Body = z.object({ pin: z.string().min(4).max(32) });

/**
 * Discard a pending waiver row that turned out to be a mis-submission or spam.
 *
 * PIN-gated, like deleting a registration. This used to be guarded by a bare
 * `window.confirm` on the theory that an orphan waiver holds no roster state
 * and the registrant could just re-submit. Both halves were wrong: the row is
 * the only record the app has that a signature exists at all, and in practice
 * re-submitting isn't available — the form gets closed after signup, and the
 * player has no idea anything was lost. One of these was mis-tapped away on a
 * phone and the player disappeared from the system entirely; the backup
 * couldn't help because pending_waivers wasn't exported yet either (it is now).
 *
 * Match to a registration instead whenever there's any doubt: that's the
 * non-destructive route, and it keeps the signature.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  const { id } = await params;
  const body = Body.parse(await req.json());
  if (!(await tryRateLimit(`pending-waiver-delete:${clientIp(req)}`, 5, 60))) {
    return NextResponse.json(
      { error: "嘗試次數過多,請稍後再試" },
      { status: 429 },
    );
  }
  const admin = await findAdminByPin(body.pin);
  if (!admin || admin.id !== sess.adminId) {
    return NextResponse.json({ error: "PIN 不正確" }, { status: 401 });
  }

  const { error } = await supabaseAdmin()
    .from("pending_waivers")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
