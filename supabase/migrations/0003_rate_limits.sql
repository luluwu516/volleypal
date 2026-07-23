-- Rate limiting infra for /api/auth/pin + /api/auth/unlock.
-- Keyed by IP; sliding-ish window via reset_at reset on overflow.

create table if not exists rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

-- RLS on with no policies = anon / authenticated cannot read or write.
-- service_role bypasses RLS, and it's the only client that ever touches this
-- table (via lib/rateLimit.ts → RPC).
alter table rate_limits enable row level security;

-- Atomic check-and-increment. Returns true if the caller is still under the
-- limit for this window, false if they've exceeded it.
-- When called after reset_at has elapsed, the counter resets to 1.
create or replace function try_rate_limit(k text, max_count int, window_sec int)
returns boolean
language plpgsql
as $$
declare
  current_count int;
begin
  insert into rate_limits (key, count, reset_at)
  values (k, 1, now() + make_interval(secs => window_sec))
  on conflict (key) do update set
    count = case
      when rate_limits.reset_at < now() then 1
      else rate_limits.count + 1
    end,
    reset_at = case
      when rate_limits.reset_at < now() then now() + make_interval(secs => window_sec)
      else rate_limits.reset_at
    end
  returning count into current_count;
  return current_count <= max_count;
end;
$$;

-- Optional cleanup job to purge stale rows — safe to run periodically
create or replace function purge_stale_rate_limits()
returns void
language sql
as $$
  delete from rate_limits where reset_at < now() - interval '1 day';
$$;
