-- ============================================================
-- Migration 034: Phase 4 — топ-выдача заказов (буст за кристаллы)
-- ============================================================
-- Активирует shop-товары boost_top_24h/72h, highlight_color, urgent_badge:
-- трата кристаллов теперь даёт реальный эффект на ранжирование/вид заказа.

ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ DEFAULT NULL, -- активный буст в топ
  ADD COLUMN IF NOT EXISTS highlighted   BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS urgent        BOOLEAN     NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_job_posts_boost ON job_posts(boosted_until DESC NULLS LAST);
