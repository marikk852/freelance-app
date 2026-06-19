-- ============================================================
-- Migration 036: кастомный никнейм + приватность Telegram-тега
--   display_name      — никнейм, который юзер придумывает сам (заменяет
--                       Telegram first_name в публичных местах, если задан)
--   show_telegram_tag — показывать ли @username другим пользователям
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name      VARCHAR(32),
  ADD COLUMN IF NOT EXISTS show_telegram_tag BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.display_name      IS 'Кастомный никнейм; если задан — показывается вместо first_name';
COMMENT ON COLUMN users.show_telegram_tag IS 'Если FALSE — @username скрыт от других пользователей';
