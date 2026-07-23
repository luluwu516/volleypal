-- Atomic score bump so concurrent writes never lose an update.
--
-- Previously the route did SELECT current -> compute new -> UPDATE, which is
-- classic lost-update: two admins scoring the same match at the same instant
-- both read 10, both write 11 → final 11 instead of 12. Now the arithmetic
-- lives inside Postgres via an INSERT ... ON CONFLICT DO UPDATE that increments
-- from the row's committed value under Postgres's row-level lock.
--
-- Rally-point serve auto-flip is bundled here too so it lands in the same
-- transaction as the score, avoiding a second race window.
create or replace function bump_match_score(
  p_match_id uuid,
  p_set_no int,
  p_side text,
  p_delta int
) returns jsonb
language plpgsql
as $$
declare
  updated_set match_sets;
  serving_team uuid;
begin
  if p_side not in ('a', 'b') then
    raise exception 'invalid side %', p_side;
  end if;

  insert into match_sets (match_id, set_no, score_a, score_b)
  values (
    p_match_id, p_set_no,
    case when p_side = 'a' then greatest(0, p_delta) else 0 end,
    case when p_side = 'b' then greatest(0, p_delta) else 0 end
  )
  on conflict (match_id, set_no) do update set
    score_a = case
      when p_side = 'a' then greatest(0, match_sets.score_a + p_delta)
      else match_sets.score_a
    end,
    score_b = case
      when p_side = 'b' then greatest(0, match_sets.score_b + p_delta)
      else match_sets.score_b
    end,
    updated_at = now()
  returning * into updated_set;

  -- Serve flips to whoever just scored — only on +delta (−delta is a
  -- correction and shouldn't touch the serve).
  if p_delta > 0 then
    select case when p_side = 'a' then team_a_id else team_b_id end
    into serving_team
    from matches where id = p_match_id;
    if serving_team is not null then
      update matches set serving_team_id = serving_team where id = p_match_id;
    end if;
  end if;

  return to_jsonb(updated_set);
end;
$$;
