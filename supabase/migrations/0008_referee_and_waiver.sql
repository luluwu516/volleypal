-- Referee team for each match. In group stage we auto-assign from teams not
-- playing in the same time slot. In knockout we set this dynamically when
-- the previous bracket match finishes (the loser becomes the next referee).
alter table matches
  add column if not exists referee_team_id uuid
  references teams(id) on delete set null;

-- Venue waiver URL (Google Form / PDF link shown on Home page).
alter table tournaments add column if not exists waiver_url text;
