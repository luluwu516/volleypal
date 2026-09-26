-- Atomic import of a full tournament payload. Wraps the wipe + inserts of
-- every table into one function so a bad row (wrong enum value, orphan FK,
-- etc.) rolls back the entire operation instead of leaving the DB in a
-- half-imported state.
--
-- Payload shape matches /api/admin/export output: { tournament, teams,
-- team_members, matches, match_sets, registrations, announcements }.
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
begin
  tid := (payload->'tournament'->>'id')::uuid;
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

  insert into tournaments
    select * from jsonb_populate_record(null::tournaments, payload->'tournament');

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

  return jsonb_build_object(
    'tournament_id', tid,
    'counts', jsonb_build_object(
      'registrations', jsonb_array_length(coalesce(payload->'registrations', '[]'::jsonb)),
      'teams', jsonb_array_length(coalesce(payload->'teams', '[]'::jsonb)),
      'team_members', jsonb_array_length(coalesce(payload->'team_members', '[]'::jsonb)),
      'matches', jsonb_array_length(coalesce(payload->'matches', '[]'::jsonb)),
      'match_sets', jsonb_array_length(coalesce(payload->'match_sets', '[]'::jsonb)),
      'announcements', jsonb_array_length(coalesce(payload->'announcements', '[]'::jsonb))
    )
  );
end;
$$;
