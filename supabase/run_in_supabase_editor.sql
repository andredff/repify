-- ═══════════════════════════════════════════════════════════════════════════
-- COLE ESTE SQL INTEIRO NO SUPABASE SQL EDITOR E EXECUTE
-- supabase.com/dashboard/project/mhdrvljjjjenletibjsf/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Tabela de notificações
create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  recipient_id uuid        not null references auth.users(id) on delete cascade,
  actor_id     uuid        references auth.users(id) on delete set null,
  type         text        not null,
  post_id      uuid        references public.posts(id) on delete cascade,
  body         text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notif_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notif_unread_idx    on public.notifications (recipient_id, read_at) where read_at is null;

-- 2. RLS
alter table public.notifications enable row level security;

drop policy if exists "notif_select_own" on public.notifications;
drop policy if exists "notif_update_own" on public.notifications;

create policy "notif_select_own"
  on public.notifications for select
  using (auth.uid() = recipient_id);

create policy "notif_update_own"
  on public.notifications for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- 3. Habilitar Realtime na tabela
alter table public.notifications replica identity full;

-- Adicionar à publicação de realtime (pode já existir no Supabase)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- 4. Tabela de comentários (se não existir)
create table if not exists public.post_comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.posts(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  body       text        not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "comments_select_all" on public.post_comments;
drop policy if exists "comments_insert_own" on public.post_comments;
drop policy if exists "comments_delete_own" on public.post_comments;

create policy "comments_select_all" on public.post_comments for select using (true);
create policy "comments_insert_own" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.post_comments for delete using (auth.uid() = user_id);

-- 5. Trigger contador de comentários no post
create or replace function public.posts_comments_increment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.posts set comments = comments + 1 where id = new.post_id;
  return new;
end;
$$;

create or replace function public.posts_comments_decrement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.posts set comments = greatest(comments - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_comments_after_insert on public.post_comments;
drop trigger if exists post_comments_after_delete on public.post_comments;

create trigger post_comments_after_insert
  after insert on public.post_comments
  for each row execute function public.posts_comments_increment();

create trigger post_comments_after_delete
  after delete on public.post_comments
  for each row execute function public.posts_comments_decrement();

-- 6. Trigger notificação em curtida
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.posts where id = new.post_id;
  if v_post_owner is null or v_post_owner = new.user_id then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, post_id)
  values (v_post_owner, new.user_id, 'like', new.post_id);
  return new;
end;
$$;

drop trigger if exists post_likes_notify on public.post_likes;

create trigger post_likes_notify
  after insert on public.post_likes
  for each row execute function public.notify_on_like();

-- 7. Trigger notificação em comentário
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.posts where id = new.post_id;
  if v_post_owner is null or v_post_owner = new.user_id then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, post_id, body)
  values (v_post_owner, new.user_id, 'comment', new.post_id, left(new.body, 120));
  return new;
end;
$$;

drop trigger if exists post_comments_notify on public.post_comments;

create trigger post_comments_notify
  after insert on public.post_comments
  for each row execute function public.notify_on_comment();
