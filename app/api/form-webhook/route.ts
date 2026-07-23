import { timingSafeEqual } from "node:crypto";
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
  // Lenient: accept any value shape per key; we'll coerce to string[] before pick().
  responses: z.record(z.string(), z.unknown()),
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

/**
 * Apps Script `namedValues` can occasionally include non-string-array values
 * (e.g. checkbox empties). Coerce everything to string[] so pick() is safe.
 */
function normalizeResponses(raw: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      out[k] = v.map((x) => String(x ?? ""));
    } else if (v == null) {
      out[k] = [];
    } else {
      out[k] = [String(v)];
    }
  }
  return out;
}

const POSITIONS = ["setter", "outside", "middle", "opposite", "libero", "any"];
const GENDERS = ["male", "female", "other"];

function normalizePosition(raw: string | null): string {
  if (!raw) return "any";
  const lower = raw.toLowerCase();
  if (
    lower.includes("non-setter") ||
    lower.includes("non setter") ||
    lower.includes("非舉")
  ) {
    return "any";
  }
  if (lower.includes("舉球") || lower.includes("二傳")) return "setter";
  if (lower.includes("主攻")) return "outside";
  if (lower.includes("副攻") || lower.includes("攔網")) return "middle";
  if (lower.includes("自由")) return "libero";
  if (lower.includes("接應")) return "opposite";
  for (const p of POSITIONS) if (lower.includes(p)) return p;
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

/**
 * Google Forms date items return strings in the form's locale, which can be:
 *   2026-06-15  (ISO)
 *   6/15/2026   (US M/D/Y)
 *   2026/06/15  (Y/M/D)
 *   15/6/2026   (D/M/Y — does NOT parse natively in JS)
 *   Jun 15, 2026
 * Try native Date parsing first; if that fails, try D/M/Y manually.
 * Returns null if completely unparseable rather than throwing.
 */
function parseBirthday(raw: string | null): string | null {
  if (!raw) return null;
  const native = new Date(raw);
  if (!Number.isNaN(native.getTime())) {
    return native.toISOString().slice(0, 10);
  }
  // Try D/M/Y or D-M-Y
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const secret = process.env.FORM_WEBHOOK_SHARED_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const out = {
      stage: "parse",
      error: e instanceof Error ? e.message : "invalid body",
    };
    console.warn("form-webhook 400", out);
    return NextResponse.json(out, { status: 400 });
  }

  const r = normalizeResponses(body.responses as Record<string, unknown>);
  const name = pick(r, ["name", "姓名"]);
  if (!name) {
    const out = {
      stage: "extract",
      error: "missing name field",
      responseKeys: Object.keys(r),
    };
    console.warn("form-webhook 400", out);
    return NextResponse.json(out, { status: 400 });
  }

  const birthdayRaw = pick(r, ["birthday", "生日", "dob"]);
  const birthday = parseBirthday(birthdayRaw);
  const email = pick(r, ["email", "電子郵件"]);
  const phone = pick(r, ["phone", "電話"]);
  const gender = normalizeGender(pick(r, ["gender", "性別", "sex"]));
  const position = normalizePosition(pick(r, ["position", "位置"]));

  const row: Record<string, unknown> = {
    tournament_id: body.tournament_id,
    name,
    gender,
    birthday,
    position,
    email,
    phone,
    raw_form_payload: r,
  };

  try {
    const db = supabaseAdmin();
    // Idempotency:
    //   - Email present → upsert on the (tournament_id, email) unique index
    //   - Email null    → best-effort dedupe on (tournament_id, name, birthday).
    //     Small race window if the same person submits twice within the same
    //     Vercel invocation lifecycle, but that's a very rare manual pattern.
    if (!email && birthday) {
      const { data: existing } = await db
        .from("registrations")
        .select("id")
        .eq("tournament_id", body.tournament_id)
        .eq("name", name)
        .eq("birthday", birthday)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ ok: true, dedupe: "matched_existing" });
      }
    }
    const { error } = email
      ? await db
          .from("registrations")
          .upsert(row, { onConflict: "tournament_id,email" })
      : await db.from("registrations").insert(row);
    if (error) {
      const out = {
        stage: "db",
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
        attempted_row: row,
      };
      console.error("form-webhook 400 db", out);
      return NextResponse.json(out, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      birthday_parsed: birthday,
      birthday_raw: birthdayRaw,
    });
  } catch (e) {
    console.error("form-webhook unexpected error", e);
    return NextResponse.json(
      { stage: "unknown", error: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
