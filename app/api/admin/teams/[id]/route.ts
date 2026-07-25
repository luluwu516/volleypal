import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  name: z.string().min(1).max(60),
});

// Rename a team. Team identity (element/temperament) stays put — this is
// purely a display change so admins can override auto-generated names like
// 「火象 A」 with something the players actually recognise.
export async function PATCH(
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
  const { name } = Body.parse(await req.json());
  const { error } = await supabaseAdmin()
    .from("teams")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
