import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Admin promotes a waitlisted registration onto the active roster after
 * verifying payment. Cap enforcement lives here (not at webhook time) so
 * admins retain full control of which specific waitlist rows fill the slots.
 *
 * Reject reasons (all 400 with a `reason` code the UI can render):
 *   - waiver_missing: registrant hasn't signed the waiver form yet
 *   - roster_full: max_active_participants reached
 *   - non_tw_quota_full: promoting a non-TW would exceed max_non_taiwanese
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

  const { data: reg, error: regErr } = await db
    .from("registrations")
    .select("id, tournament_id, is_active, is_taiwanese, waiver_signed_at")
    .eq("id", id)
    .maybeSingle();
  if (regErr) {
    return NextResponse.json({ error: regErr.message }, { status: 400 });
  }
  if (!reg) {
    return NextResponse.json({ error: "registration not found" }, { status: 404 });
  }
  if (reg.is_active) {
    // Already active — treat as no-op so the UI is safe to double-click.
    return NextResponse.json({ ok: true, noop: true });
  }
  if (!reg.waiver_signed_at) {
    return NextResponse.json(
      { reason: "waiver_missing", message: "尚未簽署 waiver,無法確認" },
      { status: 400 },
    );
  }

  const { data: tournament, error: tErr } = await db
    .from("tournaments")
    .select("max_active_participants, max_non_taiwanese")
    .eq("id", reg.tournament_id)
    .maybeSingle();
  if (tErr || !tournament) {
    return NextResponse.json(
      { error: "tournament lookup failed" },
      { status: 400 },
    );
  }

  const [activeTotal, activeNonTw] = await Promise.all([
    db
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", reg.tournament_id)
      .eq("is_active", true),
    db
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", reg.tournament_id)
      .eq("is_active", true)
      .eq("is_taiwanese", false),
  ]);
  const totalCount = activeTotal.count ?? 0;
  const nonTwCount = activeNonTw.count ?? 0;

  if (totalCount >= tournament.max_active_participants) {
    return NextResponse.json(
      {
        reason: "roster_full",
        message: `球員列表已滿 ${totalCount}/${tournament.max_active_participants}`,
      },
      { status: 400 },
    );
  }
  if (!reg.is_taiwanese && nonTwCount >= tournament.max_non_taiwanese) {
    return NextResponse.json(
      {
        reason: "non_tw_quota_full",
        message: `非台灣配額已滿 ${nonTwCount}/${tournament.max_non_taiwanese}`,
      },
      { status: 400 },
    );
  }

  const { error: updErr } = await db
    .from("registrations")
    .update({
      is_active: true,
      confirmed_by: sess.adminId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
