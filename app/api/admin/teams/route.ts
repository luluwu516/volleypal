import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findAdminByPin } from "@/lib/auth/pin";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

const Body = z.object({
  tournamentId: z.string().uuid(),
  pin: z.string().min(4).max(32).optional(),
});

/**
 * Wipe all teams (and the matches that reference them) for a tournament.
 * Used by the "取消分隊" button. Registrations stay; this only undoes the
 * 8-team auto-assignment so admin can re-run /api/admin/teams/generate.
 *
 * Destructive — requires the current admin's PIN whenever any team exists,
 * so a session-hijack or fat-finger can't wipe the roster in one tap.
 */
export async function DELETE(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sess.locked) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  const body = Body.parse(await req.json());
  const db = supabaseAdmin();

  // Only gate when there's actually something to lose. First-time cancel
  // (0 teams) is a no-op — no need to bother.
  const { count: existing } = await db
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", body.tournamentId);
  if ((existing ?? 0) > 0) {
    if (!body.pin) {
      return NextResponse.json(
        { error: "pin_required", message: "需輸入 PIN 才能取消目前分隊" },
        { status: 401 },
      );
    }
    if (!(await tryRateLimit(`teams-delete:${clientIp(req)}`, 5, 60))) {
      return NextResponse.json(
        { error: "嘗試次數過多,請稍後再試" },
        { status: 429 },
      );
    }
    const admin = await findAdminByPin(body.pin);
    if (!admin || admin.id !== sess.adminId) {
      return NextResponse.json({ error: "PIN 不正確" }, { status: 401 });
    }
  }

  await db.from("matches").delete().eq("tournament_id", body.tournamentId);
  const { error } = await db
    .from("teams")
    .delete()
    .eq("tournament_id", body.tournamentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
