import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
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
  venue_address: z.string().nullable().optional(),
  venue_transport: z.string().nullable().optional(),
  venue_parking: z.string().nullable().optional(),
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
  const { id } = await params;
  const body = Body.parse(await req.json());
  const { error } = await supabaseAdmin()
    .from("tournaments")
    .update(body)
    .eq("id", id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
