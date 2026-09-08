import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Discard a pending waiver row that turned out to be a mis-submission or
 * spam. No PIN — orphan waivers hold no roster state, deleting one just
 * clears clutter from the admin UI. If the registrant later re-submits the
 * waiver correctly, a fresh row appears.
 */
export async function DELETE(
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
  const { error } = await supabaseAdmin()
    .from("pending_waivers")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
