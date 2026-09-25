import { supabaseAdmin } from "../supabase/server";
import type {
  Tournament,
  Team,
  Match,
  MatchSet,
  Announcement,
  Registration,
} from "./types";

/**
 * Returns the most recently created tournament. VolleyPal is single-tournament
 * at a time, so "current" = "latest".
 */
export async function getCurrentTournament(): Promise<Tournament | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Tournament | null;
}

export async function listTeams(tournamentId: string): Promise<Team[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("teams")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Team[];
}

export async function listMatches(tournamentId: string): Promise<Match[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function listMatchSets(matchIds: string[]): Promise<MatchSet[]> {
  if (matchIds.length === 0) return [];
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("match_sets")
    .select("*")
    .in("match_id", matchIds)
    .order("set_no", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MatchSet[];
}

export async function listAnnouncements(
  tournamentId: string,
): Promise<Announcement[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("announcements")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Announcement[]).filter(
    (a) => !a.expires_at || new Date(a.expires_at) > new Date(),
  );
}

export async function listRegistrations(
  tournamentId: string,
): Promise<Registration[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("registrations")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return (data ?? []) as Registration[];
}

/**
 * Admin-confirmed player count. head+exact so no rows cross the wire — the
 * public Home page only needs this to decide whether the roster is full.
 */
export async function countActiveRegistrations(
  tournamentId: string,
): Promise<number> {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}
