-- ============================================================
-- Миграция 007: Споры
-- ============================================================

CREATE TYPE dispute_status AS ENUM (
  'open',       -- только открыт
  'reviewing',  -- арбитр рассматривает
  'resolved'    -- решение принято
);

CREATE TYPE dispute_decision AS ENUM (
  'client_wins',      -- полный возврат клиенту
  'freelancer_wins',  -- полная выплата фрилансеру
  'split'             -- разделение (split_percent % фрилансеру)
);

CREATE TABLE IF NOT EXISTS disputes (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         UUID              NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  opened_by           BIGINT            NOT NULL REFERENCES users(id),
  reason              TEXT              NOT NULL,
  client_evidence     JSONB             NOT NULL DEFAULT '[]',     -- доказательства клиента
  freelancer_evidence JSONB             NOT NULL DEFAULT '[]',     -- доказательства фрилансера
  status              dispute_status    NOT NULL DEFAULT 'open',
  decision            dispute_decision,
  split_percent       INTEGER           CHECK (split_percent BETWEEN 0 AND 100),
  arbitrator_notes    TEXT,                                        -- комментарий арбитра
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Один контракт — один активный спор
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_contract_active
  ON disputes(contract_id)
  WHERE status IN ('open', 'reviewing');

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

COMMENT ON COLUMN disputes.client_evidence     IS '[{"type": "file|text|link", "content": "..."}]';
COMMENT ON COLUMN disputes.freelancer_evidence IS '[{"type": "file|text|link", "content": "..."}]';
COMMENT ON COLUMN disputes.split_percent       IS 'Процент фрилансеру при decision = split';
