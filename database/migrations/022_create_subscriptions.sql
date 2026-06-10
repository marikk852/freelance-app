-- ============================================================
-- Migration 022: Subscriptions (Basic & Pro)
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id           SERIAL        PRIMARY KEY,
  key          VARCHAR(32)   NOT NULL UNIQUE,  -- 'basic' | 'pro' | 'max'
  name         VARCHAR(64)   NOT NULL,
  price_usd    NUMERIC(10,2) NOT NULL,
  crystals_reward INTEGER    NOT NULL DEFAULT 0,
  features     JSONB         NOT NULL DEFAULT '[]',
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,  -- admin toggle
  sort_order   INTEGER       NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id             BIGSERIAL     PRIMARY KEY,
  user_id        BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id        INTEGER       NOT NULL REFERENCES subscription_plans(id),
  status         VARCHAR(16)   NOT NULL DEFAULT 'active',  -- active | expired | cancelled
  started_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ   NOT NULL,
  tx_hash        VARCHAR(128),
  currency       VARCHAR(8)    NOT NULL DEFAULT 'USDT',
  amount_paid    NUMERIC(10,2) NOT NULL,
  crystals_given BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id   ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires   ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status    ON user_subscriptions(status);

-- Add subscription fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_plan    VARCHAR(32)  DEFAULT NULL,  -- 'basic' | 'pro' | 'max' | null
  ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMPTZ  DEFAULT NULL;

-- Seed plans
INSERT INTO subscription_plans (key, name, price_usd, crystals_reward, features, sort_order) VALUES
  ('basic', 'Basic', 5.99, 15000,
   '["verified_badge","profile_boost","15000_crystals_monthly"]'::jsonb, 1),
  ('pro', 'Pro', 15.99, 20000,
   '["pro_badge","profile_boost","listing_boost","20000_crystals_monthly"]'::jsonb, 2)
ON CONFLICT (key) DO NOTHING;
