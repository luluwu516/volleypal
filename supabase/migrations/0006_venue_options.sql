-- Venue address for one-tap map navigation
alter table tournaments add column if not exists venue_address text;

-- Structured nearby supply options. Each is newline-separated text,
-- one item per line. Optional " | <url>" suffix on a line makes it a link.
--   Chick-fil-A | https://maps.google.com/?q=Chick-fil-A+near+venue
--   In-N-Out · 5min drive
alter table tournaments add column if not exists venue_lunch_options text;
alter table tournaments add column if not exists venue_drink_options text;
