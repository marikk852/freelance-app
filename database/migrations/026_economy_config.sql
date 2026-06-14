-- ============================================================
-- Migration 026: Phase 0 — экономика в БД (конфигурируемая из админки)
-- ============================================================
-- Сводим ВСЮ тарифную конфигурацию в subscription_plans (включая строку 'free'),
-- чтобы getTierLimits (Фаза 1) читал всё из одного места. Комиссия переезжает
-- из env PLATFORM_FEE_PERCENT сюда. Кристальная экономика (пакеты/заработок/магазин)
-- — в три новые таблицы. Всё редактируется в /admark Finance.
--
-- Соглашение: NULL в *_limit = безлимит (∞).

-- ---------- subscription_plans: новые колонки ----------
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS price_early_usd       NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_standard_usd    NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_percent    NUMERIC(5,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_crystals      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starter_bonus_crystals INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earning_bonus_percent INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_gate            INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS early_level_gate      INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS active_deals_limit    INTEGER       DEFAULT NULL, -- NULL = ∞
  ADD COLUMN IF NOT EXISTS deal_max_usd          INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS portfolio_limit       INTEGER       DEFAULT NULL, -- NULL = ∞
  ADD COLUMN IF NOT EXISTS applications_limit    INTEGER       DEFAULT NULL, -- NULL = ∞
  ADD COLUMN IF NOT EXISTS job_posts_limit       INTEGER       DEFAULT NULL, -- NULL = ∞
  ADD COLUMN IF NOT EXISTS is_purchasable        BOOLEAN       NOT NULL DEFAULT TRUE;

-- Строка FREE (база для неподписчиков). НЕ покупается (is_purchasable=FALSE)
-- → не попадёт в публичный список планов и в /purchase (там whitelist basic/pro).
INSERT INTO subscription_plans
  (key, name, price_usd, crystals_reward, features, sort_order, is_active,
   commission_percent, monthly_crystals, starter_bonus_crystals, earning_bonus_percent,
   active_deals_limit, deal_max_usd, portfolio_limit, applications_limit, job_posts_limit,
   is_purchasable)
VALUES
  ('free', 'Free', 0, 0, '[]'::jsonb, 0, TRUE,
   5.00, 0, 50, 0,
   1, 500, 3, 5, 0,
   FALSE)
ON CONFLICT (key) DO NOTHING;

-- BASIC
UPDATE subscription_plans SET
  price_early_usd = 9.00, price_standard_usd = 5.99, price_usd = 5.99,
  commission_percent = 3.99,
  monthly_crystals = 500, starter_bonus_crystals = 300, crystals_reward = 300,
  earning_bonus_percent = 20,
  level_gate = 6, early_level_gate = 3,
  active_deals_limit = 5, deal_max_usd = 2000, portfolio_limit = 10,
  applications_limit = 20, job_posts_limit = 3,
  is_purchasable = TRUE
WHERE key = 'basic';

-- PRO (portfolio/applications/job_posts = NULL = ∞)
UPDATE subscription_plans SET
  price_early_usd = 29.00, price_standard_usd = 15.99, price_usd = 15.99,
  commission_percent = 2.00,
  monthly_crystals = 1500, starter_bonus_crystals = 1000, crystals_reward = 1000,
  earning_bonus_percent = 50,
  level_gate = 11, early_level_gate = 8,
  active_deals_limit = 15, deal_max_usd = 10000, portfolio_limit = NULL,
  applications_limit = NULL, job_posts_limit = NULL,
  is_purchasable = TRUE
WHERE key = 'pro';

-- ---------- crystal_packages: прямая покупка 💎 за TON ----------
CREATE TABLE IF NOT EXISTS crystal_packages (
  id             SERIAL        PRIMARY KEY,
  crystals       INTEGER       NOT NULL,
  bonus_crystals INTEGER       NOT NULL DEFAULT 0,
  price_usd      NUMERIC(10,2) NOT NULL,
  sort_order     INTEGER       NOT NULL DEFAULT 0,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO crystal_packages (crystals, bonus_crystals, price_usd, sort_order) VALUES
  (500,    0,    1.99,  1),
  (1200,   200,  3.99,  2),
  (3000,   500,  8.99,  3),
  (7000,   1500, 17.99, 4),
  (15000,  4000, 34.99, 5)
ON CONFLICT DO NOTHING;

-- ---------- crystal_actions: заработок 💎 ----------
CREATE TABLE IF NOT EXISTS crystal_actions (
  id         SERIAL       PRIMARY KEY,
  key        VARCHAR(48)  NOT NULL UNIQUE,
  label      VARCHAR(96)  NOT NULL,
  amount     INTEGER      NOT NULL,
  category   VARCHAR(24)  NOT NULL DEFAULT 'general',
  daily_cap  INTEGER      DEFAULT NULL,  -- NULL = без потолка
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO crystal_actions (key, label, amount, category, daily_cap, sort_order) VALUES
  ('daily_login',         'Вход в приложение',            10,  'daily',    1,    1),
  ('live_feed_check',     'Проверка ленты Live Deals',    5,   'daily',    1,    2),
  ('streak_day',          'Стрик (за каждый день подряд)',5,   'daily',    NULL, 3),
  ('deal_create',         'Создать сделку',               50,  'deals',    NULL, 10),
  ('deal_close',          'Закрыть сделку успешно',       200, 'deals',    NULL, 11),
  ('deal_no_dispute',     'Сделка без споров',            50,  'deals',    NULL, 12),
  ('deal_fast_close',     'Быстрое закрытие до дедлайна', 30,  'deals',    NULL, 13),
  ('deal_first_month',    'Первая сделка в месяце',       100, 'deals',    NULL, 14),
  ('review_left',         'Оставить отзыв',               25,  'social',   NULL, 20),
  ('review_5star',        'Получить отзыв 5★',            30,  'social',   NULL, 21),
  ('referral_invite',     'Пригласить друга',             100, 'social',   NULL, 22),
  ('referral_first_deal', 'Друг закрыл первую сделку',    500, 'social',   NULL, 23),
  ('profile_complete',    'Заполнить профиль 100%',       30,  'profile',  NULL, 30),
  ('level_up',            'Достичь нового уровня',        150, 'profile',  NULL, 31),
  ('portfolio_add',       'Добавить работу в портфолио',  20,  'profile',  NULL, 32),
  ('account_verified',    'Верифицировать аккаунт',       200, 'profile',  NULL, 33),
  ('deals_10',            '10 закрытых сделок',           300, 'achieve',  NULL, 40),
  ('deals_50',            '50 закрытых сделок',           1000,'achieve',  NULL, 41),
  ('deals_100',           '100 закрытых сделок',          3000,'achieve',  NULL, 42),
  ('rating_month',        'Рейтинг 4.9+ месяц подряд',    500, 'achieve',  NULL, 43),
  ('deal_of_month',       'Сделка месяца (топ платформы)',1000,'achieve',  NULL, 44)
ON CONFLICT (key) DO NOTHING;

-- ---------- crystal_shop_items: трата 💎 (только soft-товары) ----------
CREATE TABLE IF NOT EXISTS crystal_shop_items (
  id         SERIAL       PRIMARY KEY,
  key        VARCHAR(48)  NOT NULL UNIQUE,
  label      VARCHAR(96)  NOT NULL,
  cost       INTEGER      NOT NULL,
  category   VARCHAR(24)  NOT NULL DEFAULT 'general',
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO crystal_shop_items (key, label, cost, category, sort_order) VALUES
  ('boost_top_24h',           'Поднять заказ в топ 24ч',      300, 'attention',   1),
  ('boost_top_72h',           'Поднять заказ в топ 72ч',      700, 'attention',   2),
  ('highlight_color',         'Выделить заказ цветом',        150, 'attention',   3),
  ('urgent_badge',            'Значок «Срочно» на заказе',    200, 'attention',   4),
  ('profile_search_boost_7d', 'Буст профиля в поиске 7д',     400, 'attention',   5),
  ('top_freelancer_30d',      'Значок «Топ фрилансер» 30д',   800, 'attention',   6),
  ('custom_avatar',           'Кастомный пиксельный аватар',  200, 'cosmetic',    7),
  ('premium_theme',           'Премиум тема оформления',      150, 'cosmetic',    8),
  ('animated_badge',          'Анимированный значок профиля', 250, 'cosmetic',    9),
  ('profile_frame',           'Уникальная рамка профиля',     300, 'cosmetic',   10),
  ('extra_application',        'Доп. отклик (FREE)',          50,  'convenience',11),
  ('urgent_arbitration',      'Срочный арбитраж (FREE)',      400, 'convenience',12)
ON CONFLICT (key) DO NOTHING;

-- FREE-комиссия (5%) живёт в строке subscription_plans key='free' (commission_percent).
-- platform_settings.platform_fee_percent НЕ трогаем здесь: таблица создаётся init-кодом
-- admin.js, а не миграцией, и может ещё не существовать на момент прогона миграций.
