-- ─────────────────────────────────────────────────────────────────────────────
-- Follows table
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_follows (
  follower_id  uuid  not null references auth.users(id) on delete cascade,
  following_id uuid  not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_idx  on public.user_follows (follower_id);
create index if not exists follows_following_idx on public.user_follows (following_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.user_follows enable row level security;

drop policy if exists "follows_select_all"   on public.user_follows;
drop policy if exists "follows_insert_own"   on public.user_follows;
drop policy if exists "follows_delete_own"   on public.user_follows;

create policy "follows_select_all"
  on public.user_follows for select using (true);

create policy "follows_insert_own"
  on public.user_follows for insert
  with check (auth.uid() = follower_id);

create policy "follows_delete_own"
  on public.user_follows for delete
  using (auth.uid() = follower_id);

-- ── Trigger: notify on follow ─────────────────────────────────────────────────

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

drop trigger if exists user_follows_notify on public.user_follows;

create trigger user_follows_notify
  after insert on public.user_follows
  for each row execute function public.notify_on_follow();
