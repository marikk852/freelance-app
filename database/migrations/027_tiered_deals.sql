-- ============================================================
-- Migration 027: Phase 1 — тарифные сделки (комиссия + лимит суммы)
-- ============================================================
-- 1) Снимаем жёсткий CHECK amount_usd <= 500 (мешает лимитам $2000/$10000).
--    Лимит теперь enforced на уровне приложения по тарифу (deal_max_usd).
-- 2) Фиксируем ставку комиссии на сделке при создании (commission_percent),
--    чтобы смена тарифа клиентом не меняла уже идущую сделку.

-- Снять любой CHECK на amount_usd (имя авто-сгенерировано) — робастно через DO
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'contracts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%amount_usd%<=%500%'
  LOOP
    EXECUTE 'ALTER TABLE contracts DROP CONSTRAINT ' || quote_ident(c);
  END LOOP;
END $$;

-- Оставляем только проверку положительной суммы + платформенный потолок $10k (PRO)
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_amount_positive;
ALTER TABLE contracts ADD CONSTRAINT contracts_amount_positive
  CHECK (amount_usd > 0 AND amount_usd <= 10000);

-- Зафиксированная ставка комиссии на сделке (NULL → fallback на тариф/free при расчёте)
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) DEFAULT NULL;

COMMENT ON COLUMN contracts.commission_percent IS 'Ставка комиссии тарифа клиента, зафиксированная при создании сделки';
