-- Add MBTI-based grouping alongside zodiac. Four total strategies:
--   zodiac_together — 4 element buckets, snake-split A/B (current behavior)
--   zodiac_mixed    — 8 teams with elements spread across
--   mbti_together   — 4 Keirsey temperaments (NF/NT/SJ/SP), snake-split A/B
--   mbti_mixed      — 8 teams with temperaments spread across
--
-- Existing tournament rows default to zodiac_together for backward compat.

create type grouping_strategy as enum (
  'zodiac_together',
  'zodiac_mixed',
  'mbti_together',
  'mbti_mixed'
);

create type mbti_type as enum (
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP'
);

create type mbti_temperament as enum ('NF', 'NT', 'SJ', 'SP');

alter table tournaments
  add column grouping_strategy grouping_strategy
    not null default 'zodiac_together';

alter table registrations
  add column mbti mbti_type;

alter table teams
  add column temperament mbti_temperament;
