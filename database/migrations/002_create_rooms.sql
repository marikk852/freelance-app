-- ============================================================
-- Миграция 002: Комнаты сделок
-- Комната = связь клиента и фрилансера для одной сделки
-- ============================================================

CREATE TYPE room_status AS ENUM (
  'waiting',    -- создана, ждёт фрилансера
  'active',     -- оба зашли, идёт сделка
  'completed',  -- сделка завершена успешно
  'disputed',   -- открыт спор
  'cancelled'   -- отменена
);

CREATE TABLE IF NOT EXISTS rooms (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_link   VARCHAR(128)  NOT NULL UNIQUE,   -- ссылка для фрилансера
  status        room_status   NOT NULL DEFAULT 'waiting',
  client_id     BIGINT        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  freelancer_id BIGINT        REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_rooms_client_id     ON rooms(client_id);
CREATE INDEX IF NOT EXISTS idx_rooms_freelancer_id ON rooms(freelancer_id)
  WHERE freelancer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_invite_link   ON rooms(invite_link);
CREATE INDEX IF NOT EXISTS idx_rooms_status        ON rooms(status);

COMMENT ON COLUMN rooms.invite_link IS 'UUID ссылка типа t.me/safedealbot?start=room_{invite_link}';
