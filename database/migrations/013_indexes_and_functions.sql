-- ============================================================
-- Миграция 013: Дополнительные функции и индексы
-- ============================================================

-- Функция: автообновление updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггер к таблицам с updated_at
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trigger_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Функция: обновить XP и уровень пользователя
CREATE OR REPLACE FUNCTION add_xp(p_user_id BIGINT, p_xp INTEGER)
RETURNS VOID AS $$
DECLARE
  v_completed INTEGER;
BEGIN
  UPDATE users
  SET
    xp = xp + p_xp,
    safe_coins = safe_coins + (p_xp / 10),  -- 1 SafeCoin за каждые 10 XP
    deals_completed = CASE
      WHEN p_xp = 200 THEN deals_completed + 1  -- +200 XP = закрытая сделка
      ELSE deals_completed
    END,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING deals_completed INTO v_completed;

  -- Пересчитать уровень
  UPDATE users
  SET level = GREATEST(1, v_completed / 2)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Функция: обновить streak дней
CREATE OR REPLACE FUNCTION update_streak(p_user_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET
    streak_days = CASE
      WHEN last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN streak_days + 1
      WHEN last_active_date = CURRENT_DATE THEN streak_days  -- уже обновляли сегодня
      ELSE 1  -- сброс серии
    END,
    last_active_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Полнотекстовый поиск по заказам
CREATE INDEX IF NOT EXISTS idx_job_posts_fts ON job_posts
  USING gin(to_tsvector('russian', title || ' ' || description));

COMMENT ON FUNCTION add_xp IS 'XP: +50 создание, +200 закрытие, +25 отзыв, +10 вход';
COMMENT ON FUNCTION update_streak IS 'Вызывать при каждом /start или ежедневном входе';
