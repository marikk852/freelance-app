-- ============================================================
-- Миграция 008: Портфолио фрилансеров
-- Только реально закрытые сделки попадают в портфолио
-- ============================================================

CREATE TABLE IF NOT EXISTS portfolio_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id   UUID        NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  preview_url   VARCHAR(512),   -- URL защищённого превью (публичный)
  tags          JSONB       NOT NULL DEFAULT '[]',  -- ["design", "logo", ...]
  is_visible    BOOLEAN     NOT NULL DEFAULT TRUE,   -- фрилансер может скрыть
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Один контракт = одна запись в портфолио
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_contract_id ON portfolio_items(contract_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_freelancer_id ON portfolio_items(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_visible
  ON portfolio_items(freelancer_id, is_visible)
  WHERE is_visible = TRUE;

-- Только завершённые сделки попадают в портфолио (через триггер)
CREATE OR REPLACE FUNCTION check_portfolio_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM contracts
    WHERE id = NEW.contract_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Только завершённые контракты можно добавить в портфолио';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_portfolio_completed ON portfolio_items;
CREATE TRIGGER trg_check_portfolio_completed
  BEFORE INSERT OR UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION check_portfolio_completed();

COMMENT ON TABLE portfolio_items IS 'Создаётся автоматически при contracts.status = completed';
