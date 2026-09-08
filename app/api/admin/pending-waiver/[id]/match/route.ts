import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  registration_id: z.string().uuid(),
});

/**
 * Admin manually links an orphan waiver (submitted before its matching
 * registration, or with a typo'd email) to a specific registration. Stamps
 * waiver_signed_at on the registration from the orphan's submitted_at and
 * deletes the pending row.
 */
export async function POST(
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
  const { registration_id } = Body.parse(await req.json());
  const db = supabaseAdmin();

  const { data: pending, error: pErr } = await db
    .from("pending_waivers")
    .select("id, tournament_id, submitted_at")
    .eq("id", id)
    .maybeSingle();
  if (pErr || !pending) {
    return NextResponse.json({ error: "pending waiver not found" }, { status: 404 });
  }

  const { data: reg } = await db
    .from("registrations")
    .select("id, tournament_id")
    .eq("id", registration_id)
    .maybeSingle();
  if (!reg || reg.tournament_id !== pending.tournament_id) {
    return NextResponse.json(
      { error: "registration not in this tournament" },
      { status: 400 },
    );
  }

  const { error: updErr } = await db
    .from("registrations")
    .update({ waiver_signed_at: pending.submitted_at })
    .eq("id", registration_id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }
  await db.from("pending_waivers").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
