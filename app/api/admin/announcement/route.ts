import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  tournamentId: z.string().uuid(),
  body: z.string().min(1).max(500),
  level: z.enum(["info", "warn", "urgent"]).default("info"),
  expiresAt: z.string().optional(),
});

export async function POST(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = Body.parse(await req.json());
  const { error } = await supabaseAdmin().from("announcements").insert({
    tournament_id: b.tournamentId,
    body: b.body,
    level: b.level,
    expires_at: b.expiresAt ?? null,
  });
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
