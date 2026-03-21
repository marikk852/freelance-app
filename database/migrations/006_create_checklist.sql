-- ============================================================
-- Миграция 006: Чек-лист критериев приёмки
-- Клиент отмечает выполненные критерии из контракта
-- ============================================================

CREATE TABLE IF NOT EXISTS checklist_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  delivery_id   UUID        REFERENCES deliveries(id) ON DELETE SET NULL,
  criterion     TEXT        NOT NULL,     -- текст критерия из contracts.criteria
  criterion_index INTEGER   NOT NULL,     -- порядковый номер в массиве criteria
  is_checked    BOOLEAN     NOT NULL DEFAULT FALSE,
  checked_at    TIMESTAMPTZ,
  comment       TEXT                       -- комментарий клиента по этому критерию
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_checklist_contract_id ON checklist_items(contract_id);
CREATE INDEX IF NOT EXISTS idx_checklist_delivery_id ON checklist_items(delivery_id)
  WHERE delivery_id IS NOT NULL;

COMMENT ON TABLE checklist_items IS 'Создаётся при каждой попытке сдачи работы из criteria контракта';
