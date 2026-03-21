-- ============================================================
-- Миграция 005: Сдача работы фрилансером
-- ============================================================

CREATE TYPE delivery_status AS ENUM (
  'submitted',   -- фрилансер сдал
  'reviewing',   -- клиент проверяет
  'approved',    -- ПРИНЯТО → триггерит release()
  'rejected'     -- отклонено → нужны правки
);

CREATE TABLE IF NOT EXISTS deliveries (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID            NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  description     TEXT,                           -- сопроводительное сообщение
  files           JSONB           NOT NULL DEFAULT '[]',  -- зашифрованные файлы
  links           JSONB           NOT NULL DEFAULT '[]',  -- ссылки на результат
  status          delivery_status NOT NULL DEFAULT 'submitted',
  review_comment  TEXT,                           -- комментарий клиента при отклонении
  attempt_number  INTEGER         NOT NULL DEFAULT 1,     -- номер попытки
  submitted_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_deliveries_contract_id ON deliveries(contract_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status      ON deliveries(status);

COMMENT ON COLUMN deliveries.files IS '[{"originalName": "...", "encryptedPath": "...", "previewPath": "...", "mimeType": "...", "size": 0}]';
COMMENT ON COLUMN deliveries.links IS '[{"url": "...", "label": "..."}]';
COMMENT ON COLUMN deliveries.status IS 'approved = деньги разблокируются через escrowService.release()';
