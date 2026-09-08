import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Move an active roster player back to the waitlist. Reversible, so no PIN
 * gate. If the player is currently on a team, the team_members row is
 * dropped so the seat opens up; team composition otherwise stays intact for
 * the admin to fix (usually by confirming a waitlist member into the seat).
 */
export async function POST(
  _req: Request,
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
  const db = supabaseAdmin();

  const { error: memErr } = await db
    .from("team_members")
    .delete()
    .eq("registration_id", id);
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  const { error } = await db
    .from("registrations")
    .update({
      is_active: false,
      confirmed_by: null,
      confirmed_at: null,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
