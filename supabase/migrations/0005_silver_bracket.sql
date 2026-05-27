-- Add Silver-bracket phases for the losers' consolation knockout
-- (groups' 3rd & 4th places play their own elimination).
alter type match_phase add value if not exists 'silver_semifinal';
alter type match_phase add value if not exists 'silver_final';
alter type match_phase add value if not exists 'silver_third_place';
