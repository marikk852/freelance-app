-- Migration 018: Add photo_url to notifications for rich push notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS photo_url TEXT;
