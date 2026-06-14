-- ============================================================
-- Migration 028: Phase 1 — верификация (зарабатывается, не покупается)
-- ============================================================
-- verification_type: 'earned' (FREE по критериям) | 'basic' | 'pro' (от тарифа).
-- wallet_linked_at: для критерия «возраст кошелька ≥14 дней».

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_type VARCHAR(16) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wallet_linked_at  TIMESTAMPTZ DEFAULT NULL;

-- Бэкофилл: у кого уже привязан кошелёк — считаем датой привязки created_at
UPDATE users SET wallet_linked_at = created_at
  WHERE ton_wallet_address IS NOT NULL AND wallet_linked_at IS NULL;

COMMENT ON COLUMN users.verification_type IS 'earned|basic|pro — источник галочки верификации';
