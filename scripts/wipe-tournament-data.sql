-- VolleyPal: clear all match/team/registration data for one tournament,
-- keeping the tournament row itself (and its settings, venue info, PIN admins).
--
-- Usage:
--   1) Find your tournament UUID:
--        select id, name, year from tournaments;
--   2) Replace :TOURNAMENT_ID below, then run in Supabase SQL Editor.
--
-- Cascades handled automatically:
--   matches  -> match_sets, score_edits
--   teams    -> team_members
--   registrations -> team_members

\set TOURNAMENT_ID '00000000-0000-0000-0000-000000000000'  -- ← replace me

begin;

delete from matches       where tournament_id = :'TOURNAMENT_ID';
delete from teams         where tournament_id = :'TOURNAMENT_ID';
delete from registrations where tournament_id = :'TOURNAMENT_ID';
delete from announcements where tournament_id = :'TOURNAMENT_ID';

commit;

-- Verify nothing left
select 'matches'       as table, count(*) from matches       where tournament_id = :'TOURNAMENT_ID'
union all
select 'teams'         as table, count(*) from teams         where tournament_id = :'TOURNAMENT_ID'
union all
select 'registrations' as table, count(*) from registrations where tournament_id = :'TOURNAMENT_ID'
union all
select 'announcements' as table, count(*) from announcements where tournament_id = :'TOURNAMENT_ID';
