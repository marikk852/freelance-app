-- ============================================================
-- Миграция 001: Таблица пользователей
-- SafeDeal — пользователи Telegram с геймификацией
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                BIGSERIAL     PRIMARY KEY,
  telegram_id       BIGINT        NOT NULL UNIQUE,
  username          VARCHAR(64),
  first_name        VARCHAR(128),
  last_name         VARCHAR(128),
  ton_wallet_address VARCHAR(68),                    -- UQ... адрес TON кошелька
  rating            DECIMAL(3,2)  NOT NULL DEFAULT 0.00,  -- 0.00 - 5.00
  deals_count       INTEGER       NOT NULL DEFAULT 0,
  deals_completed   INTEGER       NOT NULL DEFAULT 0,
  -- Геймификация
  level             INTEGER       NOT NULL DEFAULT 1,      -- deals_completed / 2
  xp                INTEGER       NOT NULL DEFAULT 0,
  streak_days       INTEGER       NOT NULL DEFAULT 0,      -- серия входов подряд
  last_active_date  DATE,                                  -- для подсчёта streak
  safe_coins        INTEGER       NOT NULL DEFAULT 0,      -- внутренняя валюта
  -- Верификация
  is_verified       BOOLEAN       NOT NULL DEFAULT FALSE,
  -- Метаданные
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_ton_wallet  ON users(ton_wallet_address)
  WHERE ton_wallet_address IS NOT NULL;

-- Комментарии к колонкам
COMMENT ON COLUMN users.level IS 'LVL = deals_completed / 2';
COMMENT ON COLUMN users.xp    IS '+50 создание, +200 закрытие, +25 отзыв, +10 вход';
COMMENT ON COLUMN users.rating IS 'Только из реально закрытых сделок, нельзя накрутить';
