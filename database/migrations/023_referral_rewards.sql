-- ============================================================
-- Migration 023: Referral rewards tiers + activity tracking
-- ============================================================

-- Track user daily visits for activity calculation
CREATE TABLE IF NOT EXISTS user_visits (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_at DATE         NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, visited_at)
);

CREATE INDEX IF NOT EXISTS idx_user_visits_user_id ON user_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_visits_date    ON user_visits(visited_at);

-- Track which referral rewards have been claimed
CREATE TABLE IF NOT EXISTS referral_rewards (
  id           BIGSERIAL    PRIMARY KEY,
  referrer_id  BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier         VARCHAR(32)  NOT NULL,  -- '3_users' | '20_active_users'
  crystals     INTEGER      NOT NULL,
  claimed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);

-- Add telegram_channel quest type support to quests
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS quest_type    VARCHAR(32)  NOT NULL DEFAULT 'manual',
  -- types: manual | telegram_channel | deal_count | streak | referral
  ADD COLUMN IF NOT EXISTS quest_config  JSONB        DEFAULT NULL;
  -- for telegram_channel: {"channel_username": "@safedeal_news", "channel_id": "-100..."}

COMMENT ON COLUMN quests.quest_type   IS 'manual|telegram_channel|deal_count|streak|referral';
COMMENT ON COLUMN quests.quest_config IS 'JSON config per type. telegram_channel: {channel_username, channel_id}';
