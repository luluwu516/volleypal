-- VolleyPal: clear all match/team/registration data for one tournament,
-- keeping the tournament row itself (and its settings, venue info, PIN admins).
--
-- Usage:
--   1) Find your tournament UUID in Supabase SQL Editor:
--        select id, name, year from tournaments;
--   2) Replace the placeholder UUID below (one place), paste the whole file
--      into the Supabase SQL Editor, click Run.
--   3) The result grid shows how many rows were deleted from each table.
--
-- Why one big CTE: Supabase Web SQL Editor doesn't support psql meta-commands
-- (\set, :'VAR'), so parameter binding via psql variables isn't available.
-- A single data-modifying CTE lets us put the UUID in exactly one place while
-- keeping the whole wipe atomic.
--
-- Cascades handled automatically (no need to delete these tables directly):
--   matches       -> match_sets, score_edits
--   teams         -> team_members
--   registrations -> team_members
--
-- NOT wiped (intentionally): admins, import_backups, rate_limits, the
-- tournament row itself. Wipe the whole tournament via Admin UI or
-- `delete from tournaments where id = ...;` if that's what you want.

with
  target as (select '00000000-0000-0000-0000-000000000000'::uuid as id),  -- ← replace me
  d_matches       as (delete from matches       m using target t where m.tournament_id = t.id returning 1),
  d_teams         as (delete from teams         x using target t where x.tournament_id = t.id returning 1),
  d_registrations as (delete from registrations r using target t where r.tournament_id = t.id returning 1),
  d_announcements as (delete from announcements a using target t where a.tournament_id = t.id returning 1)
select
  (select count(*) from d_matches)       as matches_deleted,
  (select count(*) from d_teams)         as teams_deleted,
  (select count(*) from d_registrations) as registrations_deleted,
  (select count(*) from d_announcements) as announcements_deleted;
