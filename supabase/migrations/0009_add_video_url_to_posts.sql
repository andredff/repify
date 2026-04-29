-- Add video_url column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url text;

-- NOTE: Also create the 'workout-videos' Storage bucket in the Supabase dashboard:
--   Storage → New bucket → Name: workout-videos → Public: true
