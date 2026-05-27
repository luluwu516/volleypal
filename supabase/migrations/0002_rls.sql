-- RLS: public read for tournament-facing tables; all writes via service_role from server routes.
-- Admin auth is handled at the Next.js layer (PIN + signed cookie), not Supabase Auth,
-- so we keep RLS simple: anon can SELECT, only service_role can mutate.

alter table tournaments enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table match_sets enable row level security;
alter table announcements enable row level security;

-- Public read
create policy "public read tournaments" on tournaments for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read match_sets" on match_sets for select using (true);
create policy "public read announcements" on announcements for select using (true);

-- Sensitive tables: no anon access at all
alter table registrations enable row level security;
alter table team_members enable row level security;
alter table admins enable row level security;
alter table admin_sessions enable row level security;
alter table score_edits enable row level security;

-- Team roster is public-read but registrations themselves are not (PII)
create policy "public read team_members" on team_members for select using (true);
