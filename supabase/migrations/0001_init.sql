-- VolleyPal — consolidated baseline schema.
-- All test data was discarded before this consolidation; previous 0001-0008
-- incremental migrations have been collapsed into this single file.
--
-- Single source of truth: Supabase Postgres. Google Sheets is export-only.
-- Admin auth lives at the Next.js layer (iron-session cookies), not Supabase.

create extension if not exists pgcrypto;

create type tournament_mode as enum ('classic', 'zodiac');
create type element_type as enum ('fire', 'earth', 'air', 'water');
create type gender_type as enum ('male', 'female', 'other');
create type position_type as enum (
  'setter', 'outside', 'middle', 'opposite', 'libero', 'any'
);
create type match_phase as enum (
  'group',
  'semifinal', 'final', 'third_place',                -- Gold bracket
  'silver_semifinal', 'silver_final', 'silver_third_place'
);
create type match_status as enum ('pending', 'live', 'finished');
create type group_label as enum ('A', 'B');
create type announcement_level as enum ('info', 'warn', 'urgent');

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  mode tournament_mode not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  match_day_date date,
  num_courts smallint not null default 2,
  match_duration_min smallint not null default 30,
  group_stage_time_limit_min smallint,

  -- Public-facing tournament info (rendered on Home page)
  rules_doc_url text,
  registration_form_url text,
  waiver_url text,
  venue_address text,
  venue_transport text,
  venue_nearby text,
  venue_lunch_options text,
  venue_drink_options text,
  dinner_venue_name text,
  dinner_venue_address text,

  created_at timestamptz not null default now()
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  gender gender_type,
  birthday date,
  position position_type not null default 'any',
  skill_level smallint check (skill_level between 1 and 5),
  phone text,
  email text,
  raw_form_payload jsonb,
  created_at timestamptz not null default now(),
  unique (tournament_id, email)
);
create index on registrations (tournament_id);

create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  color text,
  element element_type,
  captain_registration_id uuid references registrations(id) on delete set null,
  seed smallint,
  created_at timestamptz not null default now()
);
create index on teams (tournament_id);

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  registration_id uuid not null references registrations(id) on delete cascade,
  role text,
  primary key (team_id, registration_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  phase match_phase not null,
  group_label group_label,
  court smallint,
  scheduled_at timestamptz,
  team_a_id uuid references teams(id) on delete set null,
  team_b_id uuid references teams(id) on delete set null,
  team_a_source text,
  team_b_source text,
  status match_status not null default 'pending',
  serving_team_id uuid references teams(id) on delete set null,
  winner_team_id uuid references teams(id) on delete set null,
  referee_team_id uuid references teams(id) on delete set null,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on matches (tournament_id, phase);
create index on matches (tournament_id, status);

create table match_sets (
  match_id uuid not null references matches(id) on delete cascade,
  set_no smallint not null,
  score_a smallint not null default 0,
  score_b smallint not null default 0,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (match_id, set_no)
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  body text not null,
  level announcement_level not null default 'info',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index on announcements (tournament_id, created_at desc);

-- Audit trail for scoring edits (admin attribution)
create table score_edits (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  admin_id uuid references admins(id) on delete set null,
  set_no smallint,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index on score_edits (match_id, created_at desc);

-- updated_at triggers
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger matches_updated_at before update on matches
  for each row execute function set_updated_at();

create trigger match_sets_updated_at before update on match_sets
  for each row execute function set_updated_at();
