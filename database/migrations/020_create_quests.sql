-- ============================================================
-- Migration 020: Quests / Tasks system
-- ============================================================

CREATE TABLE IF NOT EXISTS quests (
  id          SERIAL        PRIMARY KEY,
  key         VARCHAR(64)   NOT NULL UNIQUE,   -- machine key e.g. 'complete_profile'
  title       VARCHAR(128)  NOT NULL,
  description TEXT          NOT NULL,
  coins       INTEGER       NOT NULL,           -- reward in SafeCoins
  icon        VARCHAR(16)   NOT NULL DEFAULT '🎯',
  category    VARCHAR(32)   NOT NULL DEFAULT 'general',  -- general|social|deals
  is_repeatable BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_quests (
  id          BIGSERIAL     PRIMARY KEY,
  user_id     BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id    INTEGER       NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user_id ON user_quests(user_id);

-- ---- Seed quests ----
INSERT INTO quests (key, title, description, coins, icon, category, sort_order) VALUES
  ('link_wallet',        'Link TON Wallet',         'Connect your TON wallet to your profile',                    100, '💎', 'general', 1),
  ('complete_profile',   'Complete Profile',         'Add bio, country and skills to your profile',               50,  '👤', 'general', 2),
  ('first_deal',         'First Deal',               'Create your first deal on SafeDeal',                        100, '⚔️', 'deals',   3),
  ('first_completed',    'Deal Closer',              'Successfully complete your first deal',                     200, '🏆', 'deals',   4),
  ('five_deals',         'Veteran',                  'Complete 5 deals',                                          300, '🎖️', 'deals',   5),
  ('first_review',       'Reputation Builder',       'Receive your first review from a client or freelancer',     150, '⭐', 'general', 6),
  ('streak_7',           '7-Day Streak',             'Log in 7 days in a row',                                    100, '🔥', 'general', 7),
  ('streak_30',          '30-Day Streak',             'Log in 30 days in a row',                                   500, '🔥', 'general', 8),
  ('first_referral',     'First Referral',           'Invite a friend who registers via your referral link',       50, '👥', 'social',  9),
  ('five_referrals',     'Community Builder',        'Invite 5 friends via your referral link',                   200, '👥', 'social',  10),
  ('post_job',           'Job Poster',               'Post your first job on the Job Board',                       50, '📌', 'deals',   11),
  ('first_portfolio',    'Portfolio Star',           'Add your first item to the portfolio',                       50, '📁', 'general', 12)
ON CONFLICT (key) DO NOTHING;
