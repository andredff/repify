-- Add optimized image size columns to posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS photo_url_medium TEXT,
  ADD COLUMN IF NOT EXISTS photo_url_thumb  TEXT;
