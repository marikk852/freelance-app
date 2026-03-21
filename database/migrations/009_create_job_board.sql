-- ============================================================
-- Миграция 009: Биржа заказов (Job Board)
-- Клиенты публикуют заказы, фрилансеры откликаются
-- ============================================================

CREATE TYPE job_status AS ENUM (
  'open',       -- открыт, принимает отклики
  'in_review',  -- клиент рассматривает отклики
  'closed',     -- закрыт без выбора
  'taken'       -- фрилансер выбран, сделка создана
);

CREATE TYPE application_status AS ENUM (
  'pending',   -- ожидает ответа
  'accepted',  -- принят → создаётся room + contract
  'rejected'   -- отклонён
);

CREATE TABLE IF NOT EXISTS job_posts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            VARCHAR(256) NOT NULL,
  description      TEXT        NOT NULL,
  budget_min       DECIMAL(10,2) CHECK (budget_min >= 0),
  budget_max       DECIMAL(10,2) CHECK (budget_max <= 500),
  currency         contract_currency NOT NULL DEFAULT 'USDT',
  deadline         INTEGER,            -- дней на выполнение
  category         VARCHAR(64),        -- design, dev, writing, ...
  skills_required  JSONB       NOT NULL DEFAULT '[]',
  status           job_status  NOT NULL DEFAULT 'open',
  views_count      INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS job_applications (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id     UUID                NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  freelancer_id   BIGINT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter    TEXT,
  proposed_amount DECIMAL(10,2)       CHECK (proposed_amount > 0 AND proposed_amount <= 500),
  status          application_status  NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Один фрилансер — один отклик на заказ
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique
  ON job_applications(job_post_id, freelancer_id);

CREATE INDEX IF NOT EXISTS idx_job_posts_client_id ON job_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_job_posts_status    ON job_posts(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_posts_category  ON job_posts(category)
  WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_freelancer ON job_applications(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_post  ON job_applications(job_post_id);

COMMENT ON COLUMN job_posts.budget_max IS 'Ограничено $500 (лимит MVP)';
