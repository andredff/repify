alter table public.posts
  add column if not exists photo_gallery jsonb;
