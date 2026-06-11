-- Migration 024: Fix tx_hash column — BOC from TonConnect exceeds VARCHAR(128)
ALTER TABLE user_subscriptions
  ALTER COLUMN tx_hash TYPE TEXT;
