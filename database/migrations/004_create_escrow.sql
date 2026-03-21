-- ============================================================
-- Миграция 004: Эскроу записи
-- Отражает состояние смарт-контракта на блокчейне
-- ============================================================

CREATE TYPE escrow_status AS ENUM (
  'waiting_payment',  -- контракт задеплоен, ждём депозита
  'frozen',           -- деньги заморожены в контракте
  'released',         -- выплачено фрилансеру
  'refunded'          -- возвращено клиенту
);

CREATE TABLE IF NOT EXISTS escrow (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           UUID          NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  currency              contract_currency NOT NULL,
  amount                DECIMAL(20,9) NOT NULL,        -- в единицах валюты (TON или USDT)
  amount_usd            DECIMAL(10,2) NOT NULL,        -- в USD по курсу на момент создания
  platform_fee          DECIMAL(20,9) NOT NULL DEFAULT 0, -- комиссия 2%
  status                escrow_status NOT NULL DEFAULT 'waiting_payment',
  ton_contract_address  VARCHAR(68)   NOT NULL,        -- адрес смарт-контракта
  tx_hash_in            VARCHAR(128),                  -- хэш транзакции депозита
  tx_hash_out           VARCHAR(128),                  -- хэш транзакции выплаты
  frozen_at             TIMESTAMPTZ,                   -- когда деньги заморозились
  released_at           TIMESTAMPTZ,                   -- когда выплачено/возвращено
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Один контракт — одна эскроу запись
CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_contract_id ON escrow(contract_id);

CREATE INDEX IF NOT EXISTS idx_escrow_status      ON escrow(status);
CREATE INDEX IF NOT EXISTS idx_escrow_ton_address ON escrow(ton_contract_address);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_hash_in  ON escrow(tx_hash_in)
  WHERE tx_hash_in IS NOT NULL;

COMMENT ON TABLE escrow IS 'Зеркало состояния смарт-контракта в PostgreSQL для быстрых запросов';
COMMENT ON COLUMN escrow.tx_hash_in  IS 'Хэш транзакции от клиента на контракт (депозит)';
COMMENT ON COLUMN escrow.tx_hash_out IS 'Хэш транзакции от контракта (release/refund)';
