begin;

with target_user as (
  select id
  from auth.users
  where email = 'andredff@gmail.com'
), deleted_workout_events as (
  delete from public.xp_events
  where user_id in (select id from target_user)
    and type = 'workout'
  returning id
), deleted_history as (
  delete from public.workout_history
  where user_id in (select id from target_user)
  returning id
), deleted_day_sessions as (
  delete from public.workout_day_sessions
  where user_id in (select id from target_user)
  returning user_id
), deleted_programs as (
  delete from public.workout_programs
  where user_id in (select id from target_user)
  returning user_id
), remaining_events as (
  select
    e.user_id,
    coalesce(sum(e.xp), 0)::int as total_xp,
    coalesce(
      sum(e.xp) filter (
        where e.created_at::date >= (current_date - extract(dow from current_date)::int)
      ),
      0
    )::int as weekly_xp
  from public.xp_events e
  where e.user_id in (select id from target_user)
  group by e.user_id
), streak_dates as (
  select distinct e.user_id, e.created_at::date as event_date
  from public.xp_events e
  where e.user_id in (select id from target_user)
), streak_scan as (
  select
    tu.id as user_id,
    gs.day::date as day,
    exists (
      select 1
      from streak_dates sd
      where sd.user_id = tu.id
        and sd.event_date = gs.day::date
    ) as has_event,
    row_number() over (partition by tu.id order by gs.day desc) as rn
  from target_user tu
  cross join lateral generate_series(current_date, current_date - interval '364 day', interval '-1 day') as gs(day)
), streak_break as (
  select
    user_id,
    coalesce(min(rn) filter (where not has_event), 366) as first_missing_rn
  from streak_scan
  group by user_id
), recalculated_stats as (
  select
    tu.id as user_id,
    coalesce(re.total_xp, 0) as total_xp,
    coalesce(re.weekly_xp, 0) as weekly_xp,
    greatest(coalesce(sb.first_missing_rn, 1) - 1, 0)::int as streak_days,
    (current_date - extract(dow from current_date)::int)::date as week_start,
    now() as updated_at
  from target_user tu
  left join remaining_events re on re.user_id = tu.id
  left join streak_break sb on sb.user_id = tu.id
)
insert into public.user_stats (user_id, total_xp, weekly_xp, streak_days, week_start, updated_at)
select user_id, total_xp, weekly_xp, streak_days, week_start, updated_at
from recalculated_stats
on conflict (user_id) do update
set total_xp = excluded.total_xp,
    weekly_xp = excluded.weekly_xp,
    streak_days = excluded.streak_days,
    week_start = excluded.week_start,
    updated_at = excluded.updated_at;

update auth.users
set raw_user_meta_data = jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{workouts_done}', '0'::jsonb, true),
        '{weekly_goal_completed_weeks}',
        '[]'::jsonb,
        true
      ),
      '{weekly_goal_best_streak}',
      '0'::jsonb,
      true
    )
where email = 'andredff@gmail.com';

commit;

-- Verificacao rapida
select
  u.email,
  (select count(*) from public.workout_history h where h.user_id = u.id) as workout_history_count,
  (select count(*) from public.workout_day_sessions s where s.user_id = u.id) as workout_day_sessions_count,
  (select count(*) from public.workout_programs p where p.user_id = u.id) as workout_programs_count,
  (select count(*) from public.xp_events e where e.user_id = u.id and e.type = 'workout') as workout_xp_events_count,
  us.total_xp,
  us.weekly_xp,
  us.streak_days,
  u.raw_user_meta_data ->> 'workouts_done' as workouts_done,
  u.raw_user_meta_data -> 'weekly_goal_completed_weeks' as weekly_goal_completed_weeks,
  u.raw_user_meta_data ->> 'weekly_goal_best_streak' as weekly_goal_best_streak
from auth.users u
left join public.user_stats us on us.user_id = u.id
where u.email = 'andredff@gmail.com';
