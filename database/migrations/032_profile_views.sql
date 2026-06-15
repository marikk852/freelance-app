-- ============================================================
-- Migration 032: Phase 4 — счётчик просмотров профиля (для аналитики PRO)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_views INTEGER NOT NULL DEFAULT 0;
