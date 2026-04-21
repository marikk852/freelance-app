-- Migration 014: Extended user profile fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio              VARCHAR(300),
  ADD COLUMN IF NOT EXISTS role            VARCHAR(20)  DEFAULT 'both',       -- 'client' | 'freelancer' | 'both'
  ADD COLUMN IF NOT EXISTS category        VARCHAR(50),                        -- 'design' | 'dev' | 'writing' | 'video' | 'marketing' | 'other'
  ADD COLUMN IF NOT EXISTS skills          JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS experience      VARCHAR(20),                        -- 'junior' | 'middle' | 'senior'
  ADD COLUMN IF NOT EXISTS account_type    VARCHAR(20)  DEFAULT 'individual',  -- 'individual' | 'company'
  ADD COLUMN IF NOT EXISTS company_name    VARCHAR(150),
  ADD COLUMN IF NOT EXISTS company_url     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country         VARCHAR(60),
  ADD COLUMN IF NOT EXISTS portfolio_url   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS github_url      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.role         IS 'client | freelancer | both';
COMMENT ON COLUMN users.experience   IS 'junior | middle | senior';
COMMENT ON COLUMN users.account_type IS 'individual | company';
COMMENT ON COLUMN users.skills       IS 'JSONB array of skill strings';
