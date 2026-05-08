-- ============================================================
-- Migration 019: Referral system
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by     BIGINT DEFAULT NULL,  -- telegram_id of referrer
  ADD COLUMN IF NOT EXISTS referral_count  INTEGER NOT NULL DEFAULT 0;  -- how many users this user referred

-- Index for fast referral lookup
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by) WHERE referred_by IS NOT NULL;

COMMENT ON COLUMN users.referred_by    IS 'telegram_id of the user who invited this user';
COMMENT ON COLUMN users.referral_count IS 'total number of users registered via this user referral link';
