import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({ tournamentId: z.string().uuid() });

/**
 * Wipe all teams (and the matches that reference them) for a tournament.
 * Used by the "取消分隊" button. Registrations stay; this only undoes the
 * 8-team auto-assignment so admin can re-run /api/admin/teams/generate.
 */
export async function DELETE(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { tournamentId } = Body.parse(await req.json());
  const db = supabaseAdmin();
  await db.from("matches").delete().eq("tournament_id", tournamentId);
  const { error } = await db
    .from("teams")
    .delete()
    .eq("tournament_id", tournamentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
