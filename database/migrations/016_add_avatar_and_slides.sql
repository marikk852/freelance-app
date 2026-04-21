-- Migration 016: Avatar + portfolio slides (up to 5 images)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS slide_images    JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN users.avatar_url   IS 'Square profile avatar, 400x400 JPEG';
COMMENT ON COLUMN users.slide_images IS 'Array of up to 5 image URLs for profile slider';
