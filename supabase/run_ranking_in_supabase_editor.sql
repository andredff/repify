-- Paste this entire block in Supabase SQL Editor → Run
-- Creates the ranking tables, policies, and RPCs.

-- user_stats
create table if not exists public.user_stats (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  total_xp    integer not null default 0,
  weekly_xp   integer not null default 0,
  streak_days integer not null default 0,
  week_start  date    not null default date_trunc('week', now())::date,
  updated_at  timestamptz not null default now()
);
alter table public.user_stats enable row level security;

drop policy if exists "anyone can read user_stats"   on public.user_stats;
drop policy if exists "user can upsert own stats"    on public.user_stats;
drop policy if exists "user can update own stats"    on public.user_stats;

create policy "anyone can read user_stats"
  on public.user_stats for select using (true);
create policy "user can upsert own stats"
  on public.user_stats for insert with check (auth.uid() = user_id);
create policy "user can update own stats"
  on public.user_stats for update using (auth.uid() = user_id);

-- xp_events
create table if not exists public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  xp         integer not null,
  created_at timestamptz not null default now()
);
alter table public.xp_events enable row level security;

drop policy if exists "user can insert own xp_events"   on public.xp_events;
drop policy if exists "user can read own xp_events"     on public.xp_events;
drop policy if exists "service can read all xp_events"  on public.xp_events;
drop policy if exists "service can insert xp_events"    on public.xp_events;

create policy "user can insert own xp_events"
  on public.xp_events for insert with check (auth.uid() = user_id);
create policy "user can read own xp_events"
  on public.xp_events for select using (auth.uid() = user_id);
create policy "service can read all xp_events"
  on public.xp_events for select using (auth.role() = 'service_role');
create policy "service can insert xp_events"
  on public.xp_events for insert with check (auth.role() = 'service_role');

-- realtime
alter table public.user_stats replica identity full;
alter publication supabase_realtime add table public.user_stats;

-- RPC: get_ranking
create or replace function public.get_ranking(
  p_mode  text    default 'global',
  p_limit integer default 10
)
returns table (
  rank        bigint,
  user_id     uuid,
  total_xp    integer,
  weekly_xp   integer,
  streak_days integer
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by
      case when p_mode = 'weekly' then us.weekly_xp else us.total_xp end desc
    ) as rank,
    us.user_id,
    us.total_xp,
    us.weekly_xp,
    us.streak_days
  from user_stats us
  order by
    case when p_mode = 'weekly' then us.weekly_xp else us.total_xp end desc
  limit p_limit;
$$;

-- RPC: get_user_rank
create or replace function public.get_user_rank(
  p_user_id uuid,
  p_mode    text default 'global'
)
returns table (
  rank        bigint,
  total_xp    integer,
  weekly_xp   integer,
  streak_days integer
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      us.user_id,
      us.total_xp,
      us.weekly_xp,
      us.streak_days,
      row_number() over (order by
        case when p_mode = 'weekly' then us.weekly_xp else us.total_xp end desc
      ) as rank
    from user_stats us
  )
  select rank, total_xp, weekly_xp, streak_days
  from ranked
  where user_id = p_user_id;
$$;
