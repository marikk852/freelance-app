-- ============================================================
-- Миграция 011: Уведомления пользователей
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(64) NOT NULL,   -- payment_received, work_submitted, deal_completed, ...
  message     TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',  -- дополнительные данные для кнопок
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON notifications(user_id)
  WHERE is_read = FALSE;

-- Автоудаление старых прочитанных уведомлений (старше 30 дней)
-- Запускается через pg_cron или node-cron
COMMENT ON TABLE notifications IS 'Хранить не более 30 дней для прочитанных';
COMMENT ON COLUMN notifications.type IS
  'payment_received | work_submitted | work_approved | work_rejected | '
  'deal_completed | dispute_opened | dispute_resolved | new_application | '
  'deadline_reminder | welcome';
COMMENT ON COLUMN notifications.payload IS '{"contractId": "...", "roomId": "...", "amount": "..."}';
