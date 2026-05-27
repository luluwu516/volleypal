-- Tournament-level extra info shown on Home page
alter table tournaments add column if not exists rules_doc_url text;
alter table tournaments add column if not exists registration_form_url text;
alter table tournaments add column if not exists venue_transport text;
alter table tournaments add column if not exists venue_parking text;
alter table tournaments add column if not exists venue_nearby text;
