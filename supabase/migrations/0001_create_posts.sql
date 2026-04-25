-- ─────────────────────────────────────────────────────────────────────────────
-- Posts table — armazena publicações do feed
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  caption         text,
  photo_url       text,
  workout_name    text,
  workout_muscle  text,
  likes           int  not null default 0,
  comments        int  not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists posts_user_id_idx    on public.posts (user_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — usuário só pode inserir/apagar os próprios posts; SELECT é público
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.posts enable row level security;

drop policy if exists "posts_select_all"  on public.posts;
drop policy if exists "posts_insert_own"  on public.posts;
drop policy if exists "posts_delete_own"  on public.posts;
drop policy if exists "posts_update_own"  on public.posts;

create policy "posts_select_all"
  on public.posts for select
  using (true);

create policy "posts_insert_own"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "posts_update_own"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Likes — relação user×post (idempotência: PK composta)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "post_likes_select_all" on public.post_likes;
drop policy if exists "post_likes_insert_own" on public.post_likes;
drop policy if exists "post_likes_delete_own" on public.post_likes;

create policy "post_likes_select_all"
  on public.post_likes for select
  using (true);

create policy "post_likes_insert_own"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

create policy "post_likes_delete_own"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers para manter posts.likes sincronizado
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.posts_likes_increment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set likes = likes + 1 where id = new.post_id;
  return new;
end;
$$;

create or replace function public.posts_likes_decrement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set likes = greatest(likes - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_likes_after_insert on public.post_likes;
drop trigger if exists post_likes_after_delete on public.post_likes;

create trigger post_likes_after_insert
  after insert on public.post_likes
  for each row execute function public.posts_likes_increment();

create trigger post_likes_after_delete
  after delete on public.post_likes
  for each row execute function public.posts_likes_decrement();
