-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications table
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  -- who receives this notification
  recipient_id uuid        not null references auth.users(id) on delete cascade,
  -- who triggered it (null = system)
  actor_id     uuid        references auth.users(id) on delete set null,
  type         text        not null,   -- 'like' | 'comment' | 'workout' | 'walk'
  -- optional context
  post_id      uuid        references public.posts(id) on delete cascade,
  body         text,                   -- comment body or custom message
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notif_recipient_idx  on public.notifications (recipient_id, created_at desc);
create index if not exists notif_unread_idx     on public.notifications (recipient_id, read_at) where read_at is null;

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.notifications enable row level security;

-- Users can only see their own notifications
create policy "notif_select_own"
  on public.notifications for select
  using (auth.uid() = recipient_id);

-- Users can mark their own notifications as read (update read_at only)
create policy "notif_update_own"
  on public.notifications for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Only service-role can insert (via server-side triggers / API)
-- No insert policy = only service_role bypasses RLS

-- ── Trigger: notify on like ───────────────────────────────────────────────────

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.posts where id = new.post_id;

  -- Don't notify if you liked your own post
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

-- ── Trigger: notify on comment ────────────────────────────────────────────────

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- post_comments table needs to exist first (created by API on demand, but define trigger here)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'post_comments'
  ) then
    drop trigger if exists post_comments_notify on public.post_comments;
    create trigger post_comments_notify
      after insert on public.post_comments
      for each row execute function public.notify_on_comment();
  end if;
end;
$$;
