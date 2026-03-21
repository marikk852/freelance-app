-- ============================================================
-- Миграция 003: Контракты сделок
-- Юридические условия сделки: сумма, дедлайн, критерии приёмки
-- ============================================================

CREATE TYPE contract_currency AS ENUM ('TON', 'USDT');

CREATE TYPE contract_status AS ENUM (
  'draft',              -- создаётся клиентом
  'pending_signature',  -- ждёт подписи фрилансера
  'signed',             -- оба подписали
  'awaiting_payment',   -- ждёт оплаты
  'in_progress',        -- оплачено, работа идёт
  'under_review',       -- сдано, клиент проверяет
  'completed',          -- принято, деньги выплачены
  'disputed',           -- спор
  'refunded',           -- возврат
  'cancelled'           -- отменён
);

CREATE TABLE IF NOT EXISTS contracts (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               UUID              NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  title                 VARCHAR(256)      NOT NULL,
  description           TEXT              NOT NULL,
  amount_usd            DECIMAL(10,2)     NOT NULL CHECK (amount_usd > 0 AND amount_usd <= 500),
  currency              contract_currency NOT NULL DEFAULT 'TON',
  crypto_amount         DECIMAL(20,9),    -- точная сумма в TON/USDT после конвертации
  deadline              TIMESTAMPTZ       NOT NULL,
  criteria              JSONB             NOT NULL DEFAULT '[]', -- минимум 3 критерия
  status                contract_status   NOT NULL DEFAULT 'draft',
  signed_by_client      BOOLEAN           NOT NULL DEFAULT FALSE,
  signed_by_freelancer  BOOLEAN           NOT NULL DEFAULT FALSE,
  ton_contract_address  VARCHAR(68),      -- адрес смарт-контракта после деплоя
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_contracts_room_id   ON contracts(room_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status    ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_ton_addr  ON contracts(ton_contract_address)
  WHERE ton_contract_address IS NOT NULL;

-- Проверка: минимум 3 критерия приёмки
ALTER TABLE contracts ADD CONSTRAINT check_min_criteria
  CHECK (jsonb_array_length(criteria) >= 3);

COMMENT ON COLUMN contracts.amount_usd        IS 'Лимит $500 на старте (без аудита)';
COMMENT ON COLUMN contracts.criteria          IS '[{"id": "uuid", "text": "...", "required": true}]';
COMMENT ON COLUMN contracts.ton_contract_address IS 'Заполняется после деплоя смарт-контракта';
