import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  name: z.string().min(1).max(120).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  grouping_strategy: z
    .enum(["zodiac_together", "zodiac_mixed", "mbti_together", "mbti_mixed"])
    .optional(),
  // ISO 8601 UTC string (from datetime-local converted to UTC on client) or
  // null to unset. Empty string coerces to null so the picker's "clear"
  // button can just send "".
  teams_public_at: z
    .union([z.string().datetime({ offset: true }).nullable(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .optional(),
  num_courts: z.number().int().min(1).max(8).optional(),
  match_duration_min: z.number().int().min(10).max(180).optional(),
  group_stage_time_limit_min: z.number().int().nullable().optional(),
  rules_doc_url: z.string().url().nullable().optional().or(z.literal("")),
  registration_form_url: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal("")),
  waiver_url: z.string().url().nullable().optional().or(z.literal("")),
  venue_address: z.string().nullable().optional(),
  venue_transport: z.string().nullable().optional(),
  venue_nearby: z.string().nullable().optional(),
  venue_lunch_options: z.string().nullable().optional(),
  venue_drink_options: z.string().nullable().optional(),
  dinner_venue_name: z.string().nullable().optional(),
  dinner_venue_address: z.string().nullable().optional(),
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
  const body = Body.parse(await req.json());
  const { error } = await supabaseAdmin()
    .from("tournaments")
    .update(body)
    .eq("id", id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
