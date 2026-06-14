-- ============================================================
-- Migration 031: ФИКС add_xp (был сломан с migration 021)
-- ============================================================
-- Проблемы старой функции (migration 013):
--   1) ссылалась на safe_coins → после переименования в safe_crystals (021)
--      add_xp ПАДАЛ при каждом вызове. Все вызовы обёрнуты в .catch(() => {}),
--      поэтому XP / deals_completed / level МОЛЧА не росли с момента 021.
--   2) RETURNS VOID — не отдавала deals_completed (нужно для вех Фазы 2).
-- В новой модели кристаллы развязаны с XP (crystalService), поэтому начисление
-- кристаллов из add_xp УБРАНО полностью. Функция теперь только XP/level/deals.

DROP FUNCTION IF EXISTS add_xp(BIGINT, INTEGER);

CREATE FUNCTION add_xp(p_user_id BIGINT, p_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_completed INTEGER;
BEGIN
  UPDATE users
  SET
    xp = xp + p_xp,
    deals_completed = CASE
      WHEN p_xp = 200 THEN deals_completed + 1  -- +200 XP = закрытая сделка
      ELSE deals_completed
    END,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING deals_completed INTO v_completed;

  UPDATE users
  SET level = GREATEST(1, v_completed / 2)
  WHERE id = p_user_id;

  RETURN v_completed;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_xp IS 'XP/level/deals_completed. Кристаллы — отдельно (crystalService). Возвращает deals_completed.';
