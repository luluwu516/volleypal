-- Track when each match actually started (status pending → live) so the
-- timer can show remaining/elapsed time accurately, independent of the
-- originally scheduled time.
alter table matches add column if not exists started_at timestamptz;
