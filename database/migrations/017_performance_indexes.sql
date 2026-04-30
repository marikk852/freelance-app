-- ============================================================
-- Миграция 017: Индексы производительности
-- Исправляет медленные запросы монитора (500-1200ms → <10ms)
-- ============================================================

-- users
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- rooms
CREATE INDEX IF NOT EXISTS idx_rooms_client_id     ON rooms(client_id);
CREATE INDEX IF NOT EXISTS idx_rooms_freelancer_id ON rooms(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status        ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_invite_link   ON rooms(invite_link);

-- contracts
CREATE INDEX IF NOT EXISTS idx_contracts_room_id    ON contracts(room_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status     ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_deadline   ON contracts(deadline);

-- escrow
CREATE INDEX IF NOT EXISTS idx_escrow_contract_id ON escrow(contract_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status       ON escrow(status);

-- deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_contract_id ON deliveries(contract_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status      ON deliveries(status);

-- disputes
CREATE INDEX IF NOT EXISTS idx_disputes_contract_id ON disputes(contract_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status      ON disputes(status);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_contract_id ON audit_log(contract_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
