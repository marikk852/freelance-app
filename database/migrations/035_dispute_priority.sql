-- ============================================================
-- Migration 035: Phase 4 — приоритет арбитража
-- ============================================================
-- Споры обрабатываются по приоритету: тариф открывшего (FREE 0 / BASIC 1 / PRO 2),
-- либо буст за кристаллы (urgent_arbitration → 5, «срочный арбитраж»).
-- Админ-очередь сортируется по priority DESC, затем по дате (старые раньше).

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_disputes_priority ON disputes(status, priority DESC, created_at);
