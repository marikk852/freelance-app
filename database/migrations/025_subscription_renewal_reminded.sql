-- ============================================================
-- Migration 025: Subscription lifecycle — renewal reminder flag
-- ============================================================
-- Подписки в крипте не продлеваются автоматически (TonConnect требует
-- подпись пользователя на каждую транзакцию). Нужен явный жизненный цикл:
--   1. напоминание о продлении за ~3 дня до истечения
--   2. перевод просроченных в status='expired'
-- Этот флаг защищает от повторной отправки напоминания.

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_reminded BOOLEAN NOT NULL DEFAULT FALSE;
