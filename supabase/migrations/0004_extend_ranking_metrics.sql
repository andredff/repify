alter table public.user_stats
  add column if not exists total_walk_km numeric not null default 0;
