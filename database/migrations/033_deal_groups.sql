-- ============================================================
-- Migration 033: Phase 4 — milestone-сделки (этапы) для PRO, заказы >$10k
-- ============================================================
-- Каждый этап = ОБЫЧНЫЙ контракт ≤$10k (escrow.fc НЕ меняется), под зонтиком
-- deal_groups. Этапы последовательны: этап i деплоится после completed этапа i-1.
-- Все экраны (deploy/fund/deliver/approve) работают на каждый этап как есть.

CREATE TABLE IF NOT EXISTS deal_groups (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID          NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title       VARCHAR(256)  NOT NULL,
  description TEXT,
  total_usd   NUMERIC(12,2) NOT NULL,
  currency    VARCHAR(8)    NOT NULL DEFAULT 'TON',
  status      VARCHAR(16)   NOT NULL DEFAULT 'active', -- active|completed|cancelled
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deal_group_id UUID    DEFAULT NULL REFERENCES deal_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS milestone_idx INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_deal_group ON contracts(deal_group_id, milestone_idx);
