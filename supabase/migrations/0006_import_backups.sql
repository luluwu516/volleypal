-- Every /api/admin/import writes the pre-import state to this table before
-- it wipes the tournament. Gives an "oh no" recovery lane when a bad JSON
-- overwrites production. Admin can query the row + re-import it via the
-- same endpoint.

create table import_backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references admins(id) on delete set null,
  reason text,
  payload jsonb not null
);
create index on import_backups (created_at desc);

alter table import_backups enable row level security;
-- No policies → service_role only (same pattern as the other tables).
