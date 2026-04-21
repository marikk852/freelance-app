-- Migration 015: User banner image
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banner_url VARCHAR(255);

COMMENT ON COLUMN users.banner_url IS 'Path to profile banner image, served from /banners/';
