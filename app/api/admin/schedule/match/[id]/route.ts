import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findAdminByPin } from "@/lib/auth/pin";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

const CancelBody = z.object({ pin: z.string().min(4).max(32) });

/**
 * Cancel (soft) a single scheduled match. Used when the venue's booked time
 * is running out and admin needs to trim the tail (typically a placement
 * game). Sets status='canceled' rather than hard-deleting so players still
 * see the match on the schedule, marked as intentionally dropped, instead
 * of it silently vanishing and looking like a display bug.
 *
 * Guards:
 *   - only `status = 'pending'` — live/finished matches carry results the
 *     bracket / standings depend on
 *   - PIN re-check to prevent fat-finger cancellation mid-event
 *
 * Un-cancel path: regenerate schedule (whole tail gets rebuilt), or manually
 * PATCH the match's status back to 'pending' via /api/match/[id]/status.
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
  const body = CancelBody.parse(await req.json());

  if (!(await tryRateLimit(`match-cancel:${clientIp(req)}`, 5, 60))) {
    return NextResponse.json(
      { error: "嘗試次數過多,請稍後再試" },
      { status: 429 },
    );
  }
  const admin = await findAdminByPin(body.pin);
  if (!admin || admin.id !== sess.adminId) {
    return NextResponse.json({ error: "PIN 不正確" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: match, error: qErr } = await db
    .from("matches")
    .select("id, status, phase")
    .eq("id", id)
    .maybeSingle();
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 400 });
  }
  if (!match) {
    return NextResponse.json({ error: "match not found" }, { status: 404 });
  }
  if (match.status !== "pending") {
    return NextResponse.json(
      { error: `只能取消尚未開打的比賽 (目前狀態:${match.status})` },
      { status: 400 },
    );
  }

  const { error: updErr } = await db
    .from("matches")
    .update({ status: "canceled" })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, phase: match.phase });
}

/**
 * Restore a canceled match back to 'pending'. The inverse of DELETE above.
 * No PIN: putting a match back on the schedule is non-destructive, and this
 * is the recovery path for an accidental cancel — gating it behind the same
 * PIN as the destructive action would only slow down fixing a mistake.
 */
export async function PATCH(
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

  const { data: match, error: qErr } = await db
    .from("matches")
    .select("id, status, phase")
    .eq("id", id)
    .maybeSingle();
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 400 });
  }
  if (!match) {
    return NextResponse.json({ error: "match not found" }, { status: 404 });
  }
  if (match.status !== "canceled") {
    return NextResponse.json(
      { error: `只能還原已取消的比賽 (目前狀態:${match.status})` },
      { status: 400 },
    );
  }

  const { error: updErr } = await db
    .from("matches")
    .update({ status: "pending" })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, phase: match.phase });
}
