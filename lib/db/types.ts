/**
 * Domain types mirroring the Supabase schema. Hand-written (not generated)
 * because the schema is small and stable for Phase 1. If it grows, switch
 * to `supabase gen types typescript`.
 */

export type TournamentMode = "classic" | "zodiac";
export type GroupingStrategy =
  | "zodiac_together"
  | "zodiac_mixed"
  | "mbti_together"
  | "mbti_mixed";
export type ElementType = "fire" | "earth" | "air" | "water";
export type MbtiTemperament = "NF" | "NT" | "SJ" | "SP";
export type MbtiTypeCode =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";
export type GenderType = "male" | "female" | "other";
export type PositionType =
  | "setter"
  | "outside"
  | "middle"
  | "opposite"
  | "libero"
  | "any";
export type MatchPhase =
  | "group"
  | "semifinal"
  | "final"
  | "third_place"
  | "silver_semifinal"
  | "silver_final"
  | "silver_third_place";
export type MatchStatus = "pending" | "live" | "finished";
export type GroupLabel = "A" | "B";
export type AnnouncementLevel = "info" | "warn" | "urgent";

export interface Tournament {
  id: string;
  name: string;
  year: number;
  mode: TournamentMode;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  match_day_date: string | null;
  grouping_strategy: GroupingStrategy;
  teams_public_at: string | null;
  num_courts: number;
  match_duration_min: number;
  group_stage_time_limit_min: number | null;
  max_active_participants: number;
  max_non_taiwanese: number;
  allow_player_broadcast: boolean;
  rules_doc_url: string | null;
  registration_form_url: string | null;
  waiver_url: string | null;
  venue_address: string | null;
  venue_transport: string | null;
  venue_nearby: string | null;
  venue_lunch_options: string | null;
  venue_drink_options: string | null;
  dinner_venue_name: string | null;
  dinner_venue_address: string | null;
  created_at: string;
}

export interface Registration {
  id: string;
  tournament_id: string;
  name: string;
  preferred_name: string | null;
  gender: GenderType | null;
  birthday: string | null;
  position: PositionType;
  skill_level: number | null;
  mbti: MbtiTypeCode | null;
  phone: string | null;
  email: string | null;
  is_taiwanese: boolean;
  waiver_signed_at: string | null;
  is_active: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  raw_form_payload: unknown;
  created_at: string;
}

export interface PendingWaiver {
  id: string;
  tournament_id: string;
  email: string | null;
  name: string | null;
  submitted_at: string;
  raw_payload: unknown;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  color: string | null;
  element: ElementType | null;
  temperament: MbtiTemperament | null;
  captain_registration_id: string | null;
  seed: number | null;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  phase: MatchPhase;
  group_label: GroupLabel | null;
  court: number | null;
  scheduled_at: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_source: string | null;
  team_b_source: string | null;
  status: MatchStatus;
  serving_team_id: string | null;
  winner_team_id: string | null;
  referee_team_id: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchSet {
  match_id: string;
  set_no: number;
  score_a: number;
  score_b: number;
  finished_at: string | null;
  updated_at: string;
}

export type AnnouncementSource = "admin" | "player";

export interface Announcement {
  id: string;
  tournament_id: string;
  body: string;
  level: AnnouncementLevel;
  source: AnnouncementSource;
  created_at: string;
  expires_at: string | null;
}
