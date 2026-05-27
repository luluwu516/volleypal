-- Post-match dinner gathering venue (shown as the first item under "食物選擇"
-- with its own one-tap navigation button).
alter table tournaments add column if not exists dinner_venue_name text;
alter table tournaments add column if not exists dinner_venue_address text;
