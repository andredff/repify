drop index if exists public.workout_history_user_completed_date_idx;

create index if not exists workout_history_user_completed_date_idx
  on public.workout_history (user_id, completed_date desc);
