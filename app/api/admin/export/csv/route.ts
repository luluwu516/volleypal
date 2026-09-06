import { NextResponse } from "next/server";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { getAdminSession } from "@/lib/auth/getSession";
import { supabaseAdmin } from "@/lib/supabase/server";
import { elementFromBirthday, signFromBirthday } from "@/lib/zodiac";
import { MBTI_TO_TEMPERAMENT } from "@/lib/mbti";
import type { MbtiTypeCode } from "@/lib/db/types";

// Per-table CSV export for admin backup / paper printouts. `?kind=` picks
// which table to dump. Rationale for splitting from the JSON export: CSV is
// one-schema-per-file, so each table (roster / schedule / results / regs)
// downloads separately and opens cleanly in Excel / Google Sheets.
//
// UTF-8 BOM prepended so Excel-on-Windows detects the encoding without asking
// the user to import step-by-step. CRLF line endings for the same reason.

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";
const QuerySchema = z.object({
  kind: z.enum(["registrations", "teams", "schedule", "results"]),
});

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}
function csvDoc(header: string[], rows: unknown[][]): string {
  const bom = "﻿";
  return bom + [csvRow(header), ...rows.map(csvRow)].join("\r\n") + "\r\n";
}
function fmtTs(iso: string | null): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd HH:mm");
}
function attrLabel(birthdayISO: string | null): {
  sign: string;
  element: string;
} {
  if (!birthdayISO) return { sign: "", element: "" };
  try {
    const d = new Date(birthdayISO + "T12:00:00");
    return {
      sign: signFromBirthday(d),
      element: elementFromBirthday(d),
    };
  } catch {
    return { sign: "", element: "" };
  }
}

export async function GET(req: Request) {
  const sess = await getAdminSession();
  if (!sess.adminId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ kind: searchParams.get("kind") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "kind must be one of registrations|teams|schedule|results" },
      { status: 400 },
    );
  }
  const { kind } = parsed.data;

  const db = supabaseAdmin();
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, year")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "no tournament" }, { status: 404 });
  }
  const tid: string = tournament.id;
  const year: number = tournament.year;

  let body: string;
  switch (kind) {
    case "registrations":
      body = await buildRegistrationsCsv(db, tid);
      break;
    case "teams":
      body = await buildTeamsCsv(db, tid);
      break;
    case "schedule":
      body = await buildScheduleCsv(db, tid);
      break;
    case "results":
      body = await buildResultsCsv(db, tid);
      break;
  }

  const filename = `volleypal-${year}-${kind}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

type DB = ReturnType<typeof supabaseAdmin>;

async function buildRegistrationsCsv(db: DB, tid: string): Promise<string> {
  const { data } = await db
    .from("registrations")
    .select(
      "name, email, phone, gender, birthday, position, mbti, skill_level, created_at",
    )
    .eq("tournament_id", tid)
    .order("created_at", { ascending: true });
  const rows = (data ?? []).map((r) => {
    const { sign, element } = attrLabel(r.birthday);
    return [
      r.name,
      r.email ?? "",
      r.phone ?? "",
      r.gender ?? "",
      r.birthday ?? "",
      r.position ?? "",
      r.mbti ?? "",
      r.mbti ? MBTI_TO_TEMPERAMENT[r.mbti as MbtiTypeCode] : "",
      sign,
      element,
      r.skill_level ?? "",
      fmtTs(r.created_at),
    ];
  });
  return csvDoc(
    [
      "姓名",
      "Email",
      "電話",
      "性別",
      "生日",
      "場上位置",
      "MBTI",
      "MBTI 氣質",
      "星座",
      "星座象",
      "實力",
      "報名時間",
    ],
    rows,
  );
}

async function buildTeamsCsv(db: DB, tid: string): Promise<string> {
  const { data: teams } = await db
    .from("teams")
    .select("id, name, seed")
    .eq("tournament_id", tid)
    .order("seed", { ascending: true, nullsFirst: false });
  const teamIds = (teams ?? []).map((t) => t.id);
  if (teamIds.length === 0) {
    return csvDoc(
      ["隊伍", "成員姓名", "場上位置", "性別", "星座", "星座象", "MBTI"],
      [],
    );
  }
  const { data: members } = await db
    .from("team_members")
    .select("team_id, registration_id")
    .in("team_id", teamIds);
  const { data: regs } = await db
    .from("registrations")
    .select("id, name, gender, birthday, position, mbti")
    .eq("tournament_id", tid);
  const regById = new Map((regs ?? []).map((r) => [r.id, r]));

  const rows: unknown[][] = [];
  for (const t of teams ?? []) {
    const teamMembers = (members ?? []).filter((m) => m.team_id === t.id);
    if (teamMembers.length === 0) {
      rows.push([t.name, "", "", "", "", "", ""]);
      continue;
    }
    for (const m of teamMembers) {
      const r = regById.get(m.registration_id);
      if (!r) continue;
      const { sign, element } = attrLabel(r.birthday);
      rows.push([
        t.name,
        r.name,
        r.position ?? "",
        r.gender ?? "",
        sign,
        element,
        r.mbti ?? "",
      ]);
    }
  }
  return csvDoc(
    ["隊伍", "成員姓名", "場上位置", "性別", "星座", "星座象", "MBTI"],
    rows,
  );
}

async function buildScheduleCsv(db: DB, tid: string): Promise<string> {
  const { data: matches } = await db
    .from("matches")
    .select(
      "scheduled_at, court, phase, group_label, team_a_id, team_b_id, team_a_source, team_b_source, referee_team_id",
    )
    .eq("tournament_id", tid)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  const { data: teams } = await db
    .from("teams")
    .select("id, name")
    .eq("tournament_id", tid);
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  const rows = (matches ?? []).map((m) => [
    fmtTs(m.scheduled_at),
    m.court ?? "",
    m.phase,
    m.group_label ?? "",
    m.team_a_id ? teamName.get(m.team_a_id) ?? "?" : m.team_a_source ?? "TBD",
    m.team_b_id ? teamName.get(m.team_b_id) ?? "?" : m.team_b_source ?? "TBD",
    m.referee_team_id ? teamName.get(m.referee_team_id) ?? "?" : "",
  ]);
  return csvDoc(
    ["時間", "場地", "階段", "群組", "隊 A", "隊 B", "裁判"],
    rows,
  );
}

async function buildResultsCsv(db: DB, tid: string): Promise<string> {
  const { data: matches } = await db
    .from("matches")
    .select(
      "id, scheduled_at, court, phase, team_a_id, team_b_id, winner_team_id, status",
    )
    .eq("tournament_id", tid)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: sets } =
    matchIds.length === 0
      ? { data: [] as { match_id: string; set_no: number; score_a: number; score_b: number }[] }
      : await db
          .from("match_sets")
          .select("match_id, set_no, score_a, score_b")
          .in("match_id", matchIds)
          .order("set_no", { ascending: true });
  const { data: teams } = await db
    .from("teams")
    .select("id, name")
    .eq("tournament_id", tid);
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  const setsByMatch = new Map<
    string,
    { set_no: number; score_a: number; score_b: number }[]
  >();
  for (const s of sets ?? []) {
    const list = setsByMatch.get(s.match_id) ?? [];
    list.push(s);
    setsByMatch.set(s.match_id, list);
  }

  const rows = (matches ?? []).map((m) => {
    const ms = setsByMatch.get(m.id) ?? [];
    const findSet = (n: number) => ms.find((s) => s.set_no === n);
    const s1 = findSet(1);
    const s2 = findSet(2);
    const s3 = findSet(3);
    return [
      fmtTs(m.scheduled_at),
      m.court ?? "",
      m.phase,
      m.team_a_id ? teamName.get(m.team_a_id) ?? "?" : "TBD",
      m.team_b_id ? teamName.get(m.team_b_id) ?? "?" : "TBD",
      s1?.score_a ?? "",
      s1?.score_b ?? "",
      s2?.score_a ?? "",
      s2?.score_b ?? "",
      s3?.score_a ?? "",
      s3?.score_b ?? "",
      m.status,
      m.winner_team_id ? teamName.get(m.winner_team_id) ?? "" : "",
    ];
  });
  return csvDoc(
    [
      "時間",
      "場地",
      "階段",
      "隊 A",
      "隊 B",
      "Set1 A",
      "Set1 B",
      "Set2 A",
      "Set2 B",
      "Set3 A",
      "Set3 B",
      "狀態",
      "勝隊",
    ],
    rows,
  );
}
