import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findAdminByPin } from "@/lib/auth/pin";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

const PatchBody = z.object({
  skill_level: z.number().int().min(1).max(5).nullable(),
});

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
  const body = PatchBody.parse(await req.json());
  const { error } = await supabaseAdmin()
    .from("registrations")
    .update({ skill_level: body.skill_level })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

const DeleteBody = z.object({ pin: z.string().min(4).max(32) });

/**
 * Hard-delete a registration. Cascades: team_members row drops, so if this
 * player was on a team the seat opens. Admin PIN required — irreversible.
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
  const body = DeleteBody.parse(await req.json());
  if (!(await tryRateLimit(`reg-delete:${clientIp(req)}`, 5, 60))) {
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
    .from("registrations")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
