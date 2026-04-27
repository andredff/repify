create table if not exists public.workout_programs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text not null,
  level text not null,
  days integer not null,
  plans jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_programs enable row level security;

create policy "user can read own workout_programs"
  on public.workout_programs for select using (auth.uid() = user_id);

create policy "user can insert own workout_programs"
  on public.workout_programs for insert with check (auth.uid() = user_id);

create policy "user can update own workout_programs"
  on public.workout_programs for update using (auth.uid() = user_id);

create policy "user can delete own workout_programs"
  on public.workout_programs for delete using (auth.uid() = user_id);

create policy "service can manage workout_programs"
  on public.workout_programs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.workout_day_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  active_plan_id text,
  started_at timestamptz,
  completed_plan_id text,
  completed_at timestamptz,
  motivational_quote text,
  primary key (user_id, session_date)
);

alter table public.workout_day_sessions enable row level security;

create policy "user can read own workout_day_sessions"
  on public.workout_day_sessions for select using (auth.uid() = user_id);

create policy "user can insert own workout_day_sessions"
  on public.workout_day_sessions for insert with check (auth.uid() = user_id);

create policy "user can update own workout_day_sessions"
  on public.workout_day_sessions for update using (auth.uid() = user_id);

create policy "user can delete own workout_day_sessions"
  on public.workout_day_sessions for delete using (auth.uid() = user_id);

create policy "service can manage workout_day_sessions"
  on public.workout_day_sessions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.workout_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  plan_name text not null,
  muscle_group text not null,
  difficulty text not null,
  completed_at timestamptz not null,
  completed_date date not null,
  exercises_done integer not null,
  total_exercises integer not null,
  estimated_duration integer not null,
  xp_earned integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists workout_history_user_completed_date_idx
  on public.workout_history (user_id, completed_date);

create index if not exists workout_history_user_completed_at_idx
  on public.workout_history (user_id, completed_at desc);

alter table public.workout_history enable row level security;

create policy "user can read own workout_history"
  on public.workout_history for select using (auth.uid() = user_id);

create policy "user can insert own workout_history"
  on public.workout_history for insert with check (auth.uid() = user_id);

create policy "user can delete own workout_history"
  on public.workout_history for delete using (auth.uid() = user_id);

create policy "service can manage workout_history"
  on public.workout_history for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
