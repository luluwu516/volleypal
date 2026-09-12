import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { normalizeMbti } from "@/lib/mbti";

/**
 * Receives form submissions from Google Apps Script triggers.
 * Auth: `Authorization: Bearer <FORM_WEBHOOK_SHARED_SECRET>`.
 *
 * Two form types are multiplexed through this one endpoint via `form_type`:
 *   - "registration" (default): main player registration. Inserts / upserts
 *     a `registrations` row.
 *   - "waiver": venue-supplied waiver form. Matches an existing registration
 *     by lower-cased email and stamps `waiver_signed_at`. If no match,
 *     the waiver lands in `pending_waivers` for admin manual matching.
 *
 * Neither branch touches `is_active` — payment confirmation is admin-only.
 */

const Body = z.object({
  tournament_id: z.string().uuid(),
  submitted_at: z.string().optional(),
  form_type: z.enum(["registration", "waiver"]).optional(),
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

// Negation markers that flip "舉球" from a setter signal to an any signal.
// Order matters: these are checked BEFORE the positive setter phrase so an
// option like「千萬不要讓我舉球」or "please don't setter" resolves to `any`
// instead of being wrongly caught by the plain includes("舉球") branch.
const SETTER_NEGATION = ["不要", "非舉", "不想", "拒絕", "don't", "do not", "no setter", "non-setter", "non setter"];

function normalizePosition(raw: string | null): string {
  if (!raw) return "any";
  const lower = raw.toLowerCase();
  const isSetterMention =
    lower.includes("舉球") || lower.includes("二傳") || lower.includes("setter");
  if (isSetterMention && SETTER_NEGATION.some((n) => lower.includes(n))) {
    return "any";
  }
  if (isSetterMention) return "setter";
  if (lower.includes("主攻") || lower.includes("outside")) return "outside";
  if (lower.includes("副攻") || lower.includes("攔網") || lower.includes("middle")) return "middle";
  if (lower.includes("自由") || lower.includes("libero")) return "libero";
  if (lower.includes("接應") || lower.includes("opposite")) return "opposite";
  return "any";
}

/**
 * Chinese markers are unambiguous (女 ⊄ 男, 男 ⊄ 女) and checked first.
 * English needs "female" BEFORE "male" because "female".includes("male") is
 * true — the earlier `for (g of ["male","female","other"])` loop caught every
 * female answer as male, e.g. "生理女 (Female)" → "male". Verified as the
 * root cause of the whole roster landing as male after form redesign.
 */
export function normalizeGender(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("女")) return "female";
  if (lower.includes("男")) return "male";
  if (lower.includes("female")) return "female";
  if (lower.includes("male")) return "male";
  if (lower.includes("other")) return "other";
  return "other";
}

/**
 * Whether the registrant is Taiwanese. Default is true — the 10 non-TW slots
 * are reserved, so a blank / unrecognised nationality answer should NOT eat a
 * foreign-player slot. Any string suggesting non-Taiwan / foreign / overseas
 * → false; anything else → true.
 */
export function normalizeNationality(raw: string | null): boolean {
  if (!raw) return true;
  const lower = raw.toLowerCase().trim();
  // Explicit non-Taiwan markers. Order: check "non-taiwan" style negations
  // (including 非台灣/非台/外籍/國外) before the positive taiwan match, since
  // the negation string usually contains the word "台灣" too.
  const nonTwMarkers = [
    "非台", "非臺", "外籍", "外國", "海外", "國外", "其他",
    "non-taiwan", "non taiwan", "non-tw", "not taiwan", "not-taiwan",
    "foreign", "overseas", "abroad", "international", "other",
  ];
  if (nonTwMarkers.some((m) => lower.includes(m))) return false;
  // Positive taiwan markers → true.
  if (
    lower.includes("台灣") ||
    lower.includes("臺灣") ||
    lower.includes("taiwan") ||
    lower === "tw" ||
    lower === "roc"
  ) {
    return true;
  }
  // Unknown → default true (fail safe toward local, protecting the 10 slots).
  return true;
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

type DB = ReturnType<typeof supabaseAdmin>;

async function handleRegistration(
  db: DB,
  tournamentId: string,
  r: Record<string, string[]>,
) {
  const name = pick(r, ["name", "姓名"]);
  if (!name) {
    return {
      status: 400,
      body: {
        stage: "extract",
        error: "missing name field",
        responseKeys: Object.keys(r),
      },
    };
  }

  const birthdayRaw = pick(r, ["birthday", "生日", "dob"]);
  const birthday = parseBirthday(birthdayRaw);
  const email = pick(r, ["email", "e-mail", "電子郵件", "電子信箱"]);
  const phone = pick(r, ["phone", "電話"]);
  // Preferred / nickname — optional. Legal `name` remains the waiver-match
  // key; this is display-only. Aliases cover the common Google-Form title
  // variants organizers reach for.
  const preferredName = pick(r, [
    "preferred_name",
    "preferred name",
    "preferred",
    "nickname",
    "暱稱",
    "常用稱呼",
    "英文名",
  ]);
  const gender = normalizeGender(pick(r, ["gender", "性別", "sex"]));
  const position = normalizePosition(pick(r, ["position", "位置"]));
  const mbti = normalizeMbti(pick(r, ["mbti", "人格", "性格"]));
  const isTaiwanese = normalizeNationality(
    pick(r, ["國籍", "nationality", "country"]),
  );

  const row: Record<string, unknown> = {
    tournament_id: tournamentId,
    name,
    preferred_name: preferredName,
    gender,
    birthday,
    position,
    mbti,
    email,
    phone,
    is_taiwanese: isTaiwanese,
    raw_form_payload: r,
  };

  // If an orphan waiver landed first (registrant sent waiver before
  // registration, common when the two forms come from different sources),
  // stamp waiver_signed_at from the pending row and clean it up. Only runs
  // when we have an email to match on.
  if (email) {
    const { data: orphan } = await db
      .from("pending_waivers")
      .select("id, submitted_at")
      .eq("tournament_id", tournamentId)
      .ilike("email", email)
      .order("submitted_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (orphan) {
      row.waiver_signed_at = orphan.submitted_at;
    }
  }

  // Idempotency:
  //   - Email present → upsert on the (tournament_id, email) unique index.
  //     Preserve waiver_signed_at and is_active on the existing row: an edit
  //     resubmission must not silently downgrade a confirmed player.
  //   - Email null    → best-effort dedupe on (tournament_id, name, birthday).
  let insertedOrUpdated = false;
  if (!email && birthday) {
    const { data: existing } = await db
      .from("registrations")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("name", name)
      .eq("birthday", birthday)
      .maybeSingle();
    if (existing) {
      return {
        status: 200,
        body: { ok: true, dedupe: "matched_existing" },
      };
    }
  }
  if (email) {
    // Look up existing to decide insert vs update-in-place. Upsert would
    // clobber waiver_signed_at / is_active / confirmed_by, so we roll our
    // own two-branch flow.
    const { data: existing } = await db
      .from("registrations")
      .select("id, waiver_signed_at, is_active")
      .eq("tournament_id", tournamentId)
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      // Defensive update: only write fields that came in with a value.
      // Google Form edits usually skip untouched optional fields — pick()
      // returns null for those, and blindly writing null would clobber
      // known-good data (birthday, gender, mbti…). Same guard rescues us
      // from a script-attachment mistake where a waiver form's minimal
      // payload (name+email only) gets routed to the registration handler.
      const patch: Record<string, unknown> = { name };
      if (email) patch.email = email;
      // Only write when the form actually returned something. pick() collapses
      // "field absent" and "field left blank" into null; both should leave a
      // previously-set nickname alone (admin can clear it manually).
      if (preferredName != null) patch.preferred_name = preferredName;
      if (gender != null) patch.gender = gender;
      if (birthday != null) patch.birthday = birthday;
      if (position && position !== "any") patch.position = position;
      if (mbti != null) patch.mbti = mbti;
      if (phone != null) patch.phone = phone;
      // Nationality has a boolean default, so re-write it only when the
      // form actually asked and we got a definitive answer. pick() returns
      // null when the field is absent.
      const nationalityRaw = pick(r, ["國籍", "nationality", "country"]);
      if (nationalityRaw != null) patch.is_taiwanese = isTaiwanese;
      // Raw payload always refreshes — it's the audit trail of THIS submit.
      patch.raw_form_payload = r;
      // Orphan waiver carry-over (if any) — only stamp when this submission
      // actually resolved one AND the existing row hasn't been stamped yet.
      if (row.waiver_signed_at && !existing.waiver_signed_at) {
        patch.waiver_signed_at = row.waiver_signed_at;
      }
      const { error } = await db
        .from("registrations")
        .update(patch)
        .eq("id", existing.id);
      if (error) {
        return {
          status: 400,
          body: {
            stage: "db",
            error: error.message,
            code: error.code,
            hint: error.hint,
            details: error.details,
            attempted_row: patch,
          },
        };
      }
      insertedOrUpdated = true;
    }
  }
  if (!insertedOrUpdated) {
    const { error } = await db.from("registrations").insert(row);
    if (error) {
      return {
        status: 400,
        body: {
          stage: "db",
          error: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details,
          attempted_row: row,
        },
      };
    }
    insertedOrUpdated = true;
  }

  // Delete the consumed orphan waiver AFTER the registration succeeds. Doing
  // it first would risk losing the waiver stamp if the insert fails.
  if (email && row.waiver_signed_at) {
    await db
      .from("pending_waivers")
      .delete()
      .eq("tournament_id", tournamentId)
      .ilike("email", email);
  }

  return {
    status: 200,
    body: {
      ok: true,
      birthday_parsed: birthday,
      birthday_raw: birthdayRaw,
      waiver_carried_over: Boolean(row.waiver_signed_at),
    },
  };
}

async function handleWaiver(
  db: DB,
  tournamentId: string,
  r: Record<string, string[]>,
) {
  const email = pick(r, ["email", "e-mail", "電子郵件", "電子信箱"]);
  const name = pick(r, ["name", "姓名"]);
  // Waiver form MUST have email — it's the only reliable match key. Without
  // it we can't tell whose waiver this is, even manually.
  if (!email) {
    const out = {
      stage: "extract",
      error: "waiver form missing email field — cannot match to a registration",
      responseKeys: Object.keys(r),
    };
    console.warn("form-webhook waiver 400", out);
    return { status: 400, body: out };
  }

  const { data: existing } = await db
    .from("registrations")
    .select("id")
    .eq("tournament_id", tournamentId)
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("registrations")
      .update({ waiver_signed_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      return {
        status: 400,
        body: { stage: "db", error: error.message, code: error.code },
      };
    }
    return { status: 200, body: { ok: true, matched: true } };
  }

  // Orphan waiver — no matching registration yet. Stash it for admin.
  const { error } = await db.from("pending_waivers").insert({
    tournament_id: tournamentId,
    email,
    name,
    raw_payload: r,
  });
  if (error) {
    return {
      status: 400,
      body: { stage: "db", error: error.message, code: error.code },
    };
  }
  return {
    status: 200,
    body: { ok: true, matched: false, pending: true, email },
  };
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
  const formType = body.form_type ?? "registration";

  try {
    const db = supabaseAdmin();
    const result =
      formType === "waiver"
        ? await handleWaiver(db, body.tournament_id, r)
        : await handleRegistration(db, body.tournament_id, r);
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("form-webhook unexpected error", e);
    return NextResponse.json(
      { stage: "unknown", error: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
