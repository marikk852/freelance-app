-- ============================================================
-- Миграция 010: Аудит лог финансовых операций
-- ВСЕ финансовые операции логируются сюда с timestamp
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID        REFERENCES contracts(id) ON DELETE SET NULL,
  action        VARCHAR(64) NOT NULL,    -- deploy_contract, deposit, release, refund, split
  performed_by  BIGINT      REFERENCES users(id) ON DELETE SET NULL,
  details       JSONB       NOT NULL DEFAULT '{}',
  tx_hash       VARCHAR(128),           -- хэш блокчейн транзакции
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска по контракту и времени
CREATE INDEX IF NOT EXISTS idx_audit_contract_id ON audit_log(contract_id)
  WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tx_hash     ON audit_log(tx_hash)
  WHERE tx_hash IS NOT NULL;

COMMENT ON TABLE audit_log IS 'Неизменяемый лог всех финансовых операций. Никогда не удалять записи.';
COMMENT ON COLUMN audit_log.action IS 'deploy_contract | deposit | release | refund | split | dispute_open | dispute_resolve';
COMMENT ON COLUMN audit_log.details IS '{"amount": "...", "currency": "TON", "fromAddr": "...", "toAddr": "...", "feeAmount": "..."}';
