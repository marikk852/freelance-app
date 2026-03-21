-- ============================================================
-- Миграция 012: Отзывы после завершения сделки
-- Оба участника оставляют отзыв → рейтинг + XP
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID        NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  reviewer_id   BIGINT      NOT NULL REFERENCES users(id),
  reviewee_id   BIGINT      NOT NULL REFERENCES users(id),
  rating        SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Каждый участник оставляет только один отзыв по контракту
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique
  ON reviews(contract_id, reviewer_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

-- Триггер: обновить rating пользователя после нового отзыва
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET
    rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM reviews
      WHERE reviewee_id = NEW.reviewee_id
    ),
    updated_at = NOW()
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_user_rating();

COMMENT ON TABLE reviews IS 'Только из contracts.status = completed. Рейтинг нельзя накрутить.';
