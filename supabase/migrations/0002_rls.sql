-- VolleyPal — RLS policies.
-- All writes flow through Next.js API routes using the service role (which
-- bypasses RLS), so we only need to define READ policies for what the anon
-- key is allowed to fetch from the browser.
--
-- Public-readable: tournament info, teams, matches, sets, announcements,
-- team roster (no PII).
-- Strictly private: registrations (PII), admins (PIN hashes), score audit.

alter table tournaments enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table match_sets enable row level security;
alter table announcements enable row level security;
alter table team_members enable row level security;

create policy "public read tournaments"  on tournaments  for select using (true);
create policy "public read teams"        on teams        for select using (true);
create policy "public read matches"      on matches      for select using (true);
create policy "public read match_sets"   on match_sets   for select using (true);
create policy "public read announcements" on announcements for select using (true);
create policy "public read team_members" on team_members for select using (true);

-- PII / sensitive: locked down. No anon policies = no access.
alter table registrations enable row level security;
alter table admins enable row level security;
alter table score_edits enable row level security;
