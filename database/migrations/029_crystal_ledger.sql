-- ============================================================
-- Migration 029: Phase 2 — журнал кристаллов (для потолков + истории)
-- ============================================================
-- Каждое начисление/трата/грант/покупка пишется в журнал.
-- Нужен для дневных потолков заработка и истории в профиле.
-- amount: + начисление, − трата. kind: earn|spend|grant|purchase.

CREATE TABLE IF NOT EXISTS crystal_ledger (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_key VARCHAR(48)  DEFAULT NULL,  -- ключ crystal_actions / shop_item / null
  amount     INTEGER      NOT NULL,       -- + earn / − spend
  kind       VARCHAR(16)  NOT NULL DEFAULT 'earn', -- earn|spend|grant|purchase
  meta       JSONB        DEFAULT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crystal_ledger_user ON crystal_ledger(user_id, created_at DESC);
-- для дневного потолка: выборка по (user, action, день)
CREATE INDEX IF NOT EXISTS idx_crystal_ledger_cap ON crystal_ledger(user_id, action_key, created_at);
