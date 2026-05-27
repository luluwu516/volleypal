import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Receives form submissions from the Google Apps Script trigger.
 * Auth: `Authorization: Bearer <FORM_WEBHOOK_SHARED_SECRET>`.
 *
 * Payload shape (from Apps Script):
 *   {
 *     tournament_id: "...",
 *     submitted_at: "ISO",
 *     responses: { "Name": ["Alice"], "Birthday": ["1990-01-15"], ... }
 *   }
 *
 * Field names are read tolerantly. The whole `responses` object is stored in
 * `raw_form_payload` for audit / replay.
 */

const Body = z.object({
  tournament_id: z.string().uuid(),
  submitted_at: z.string().optional(),
  responses: z.record(z.string(), z.array(z.string())),
});

function pick(
  responses: Record<string, string[]>,
  keys: string[],
): string | null {
  for (const k of keys) {
    for (const formKey of Object.keys(responses)) {
      if (formKey.toLowerCase().includes(k.toLowerCase())) {
        const val = responses[formKey]?.[0]?.trim();
        if (val) return val;
      }
    }
  }
  return null;
}

const POSITIONS = ["setter", "outside", "middle", "opposite", "libero", "any"];
const GENDERS = ["male", "female", "other"];

function normalizePosition(raw: string | null): string {
  if (!raw) return "any";
  const lower = raw.toLowerCase();
  for (const p of POSITIONS) if (lower.includes(p)) return p;
  if (lower.includes("舉球") || lower.includes("二傳")) return "setter";
  if (lower.includes("主攻")) return "outside";
  if (lower.includes("副攻") || lower.includes("攔網")) return "middle";
  if (lower.includes("自由")) return "libero";
  if (lower.includes("接應")) return "opposite";
  return "any";
}

function normalizeGender(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const g of GENDERS) if (lower.includes(g)) return g;
  if (lower.includes("男")) return "male";
  if (lower.includes("女")) return "female";
  return "other";
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.FORM_WEBHOOK_SHARED_SECRET}`;
  if (!process.env.FORM_WEBHOOK_SHARED_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = Body.parse(await req.json());
    const r = body.responses;
    const name = pick(r, ["name", "姓名"]);
    if (!name) {
      return NextResponse.json({ error: "missing name field" }, { status: 400 });
    }
    const birthday = pick(r, ["birthday", "生日", "dob"]);
    const email = pick(r, ["email", "電子郵件"]);
    const phone = pick(r, ["phone", "電話"]);
    const gender = normalizeGender(pick(r, ["gender", "性別", "sex"]));
    const position = normalizePosition(pick(r, ["position", "位置"]));

    const row: Record<string, unknown> = {
      tournament_id: body.tournament_id,
      name,
      gender,
      birthday: birthday ? new Date(birthday).toISOString().slice(0, 10) : null,
      position,
      email,
      phone,
      raw_form_payload: r,
    };

    const db = supabaseAdmin();
    const { error } = email
      ? await db
          .from("registrations")
          .upsert(row, { onConflict: "tournament_id,email" })
      : await db.from("registrations").insert(row);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("form-webhook error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 400 },
    );
  }
}
