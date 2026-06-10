-- ============================================================
-- Migration 021: Rename safe_coins → safe_crystals
-- ============================================================

ALTER TABLE users RENAME COLUMN safe_coins TO safe_crystals;

-- Update quest rewards column name in quests table
ALTER TABLE quests RENAME COLUMN coins TO crystals;

COMMENT ON COLUMN users.safe_crystals IS 'Safe Crystals — internal platform currency';
