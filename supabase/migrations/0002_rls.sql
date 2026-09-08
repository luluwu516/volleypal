-- VolleyPal — RLS policies.
-- All writes flow through Next.js API routes using the service role (which
-- bypasses RLS), so we only need to define READ policies for what the anon
-- key is allowed to fetch from the browser.
--
-- Public-readable: tournament info, matches, sets, announcements.
-- Time-gated public read: teams + team_members (revealed at tournaments.
--   teams_public_at). Server components use service_role and bypass RLS, so
--   /admin still works pre-publish; this is defence in depth against anon.
-- Strictly private: registrations (PII), admins (PIN hashes), score audit.

alter table tournaments   enable row level security;
alter table teams         enable row level security;
alter table matches       enable row level security;
alter table match_sets    enable row level security;
alter table announcements enable row level security;
alter table team_members  enable row level security;

create policy "public read tournaments"   on tournaments   for select using (true);
create policy "public read matches"       on matches       for select using (true);
create policy "public read match_sets"    on match_sets    for select using (true);
create policy "public read announcements" on announcements for select using (true);

-- Teams / team_members only visible once teams_public_at has fired.
create policy "public read teams" on teams for select using (
  exists (
    select 1
    from tournaments t
    where t.id = teams.tournament_id
      and t.teams_public_at is not null
      and t.teams_public_at <= now()
  )
);
create policy "public read team_members" on team_members for select using (
  exists (
    select 1
    from teams tm
    join tournaments t on t.id = tm.tournament_id
    where tm.id = team_members.team_id
      and t.teams_public_at is not null
      and t.teams_public_at <= now()
  )
);

-- PII / sensitive: locked down. No anon policies = no access.
alter table registrations   enable row level security;
alter table admins          enable row level security;
alter table score_edits     enable row level security;
alter table pending_waivers enable row level security;
