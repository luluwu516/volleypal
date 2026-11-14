-- Atomic import of a full tournament payload. Wraps the wipe + inserts of
-- every table into one function so a bad row (wrong enum value, orphan FK,
-- etc.) rolls back the entire operation instead of leaving the DB in a
-- half-imported state.
--
-- Payload shape matches /api/admin/export output: { tournament, teams,
-- team_members, matches, match_sets, registrations, announcements,
-- pending_waivers }. Every list is coalesced to '[]', so a backup taken
-- before a table joined the export still imports — it just restores none.
-- jsonb_populate_record{,set} silently ignores keys that don't match a
-- column, so `updated_at` and any legacy fields pass through harmlessly.
--
-- Runs as service_role (RLS bypass) — same as every other admin path.
create or replace function import_tournament_payload(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  tid uuid;
  t jsonb;
  base tournaments;
begin
  t := payload->'tournament';
  tid := (t->>'id')::uuid;
  if tid is null then
    raise exception 'payload missing tournament.id';
  end if;

  -- Single-tournament app: wipe every existing tournament first. FKs cascade
  -- (see 0001) so teams / matches / registrations / announcements go with it.
  --
  -- The seemingly-redundant WHERE is load-bearing: Supabase runs pg_safeupdate,
  -- which rejects an unqualified DELETE with "DELETE requires a WHERE clause".
  -- It inspects the planned statement for a real qual, so `where true` or
  -- `where id is not null` (provably true on a NOT NULL primary key) get folded
  -- away by the planner and still trip the guard. A semi-join against the same
  -- table survives planning while matching every row.
  delete from tournaments where id in (select id from tournaments);

  -- Lay the backup over a row of column DEFAULTS rather than over nothing.
  --
  -- jsonb_populate_record fills any column the JSON has no key for from its
  -- `base` argument, and with NULL when base is NULL. So with a NULL base,
  -- every backup taken before a column existed hands NULL to that column —
  -- and a NOT NULL column rejects it, failing the entire import. That is not
  -- hypothetical: every backup on disk predates num_teams / group_rounds /
  -- skip_silver_bracket, and the oldest predates skip_third_place and
  -- grouping_strategy too.
  --
  -- Capturing the defaults means inserting a stub and reading it back, since
  -- Postgres won't hand you a table's default row any other way. The stub
  -- supplies only the columns that are NOT NULL with no default (name, year,
  -- mode) and is deleted immediately; nothing references it yet because the
  -- wipe above left the table empty and the children are inserted below.
  --
  -- Net effect: an older backup restores with today's defaults for whatever
  -- it predates, instead of refusing to restore at all.
  insert into tournaments (id, name, year, mode)
  values (
    tid,
    coalesce(t->>'name', 'restored'),
    coalesce((t->>'year')::int, extract(year from now())::int),
    coalesce((t->>'mode')::tournament_mode, 'zodiac')
  )
  returning * into base;
  delete from tournaments where id = tid;

  insert into tournaments
    select * from jsonb_populate_record(base, t);

  insert into registrations
    select * from jsonb_populate_recordset(
      null::registrations,
      coalesce(payload->'registrations', '[]'::jsonb)
    );

  insert into teams
    select * from jsonb_populate_recordset(
      null::teams,
      coalesce(payload->'teams', '[]'::jsonb)
    );

  insert into team_members
    select * from jsonb_populate_recordset(
      null::team_members,
      coalesce(payload->'team_members', '[]'::jsonb)
    );

  insert into matches
    select * from jsonb_populate_recordset(
      null::matches,
      coalesce(payload->'matches', '[]'::jsonb)
    );

  insert into match_sets
    select * from jsonb_populate_recordset(
      null::match_sets,
      coalesce(payload->'match_sets', '[]'::jsonb)
    );

  insert into announcements
    select * from jsonb_populate_recordset(
      null::announcements,
      coalesce(payload->'announcements', '[]'::jsonb)
    );

  -- Orphan waivers: signatures not yet credited to a registration. They only
  -- reference tournaments, so they can land any time after the wipe.
  insert into pending_waivers
    select * from jsonb_populate_recordset(
      null::pending_waivers,
      coalesce(payload->'pending_waivers', '[]'::jsonb)
    );

  return jsonb_build_object(
    'tournament_id', tid,
    'counts', jsonb_build_object(
      'registrations', jsonb_array_length(coalesce(payload->'registrations', '[]'::jsonb)),
      'teams', jsonb_array_length(coalesce(payload->'teams', '[]'::jsonb)),
      'team_members', jsonb_array_length(coalesce(payload->'team_members', '[]'::jsonb)),
      'matches', jsonb_array_length(coalesce(payload->'matches', '[]'::jsonb)),
      'match_sets', jsonb_array_length(coalesce(payload->'match_sets', '[]'::jsonb)),
      'announcements', jsonb_array_length(coalesce(payload->'announcements', '[]'::jsonb)),
      'pending_waivers', jsonb_array_length(coalesce(payload->'pending_waivers', '[]'::jsonb))
    )
  );
end;
$$;
