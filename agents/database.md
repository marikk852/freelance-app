# Агент 3 — Инженер БД

## Зона ответственности
- SQL миграции (database/migrations/)
- Подключение к PostgreSQL (database/db.js)
- Модели и запросы (database/models/)

## Миграции (20 файлов)
001_create_users.sql
002_create_rooms.sql
003_create_contracts.sql
004_create_escrow.sql
005_create_deliveries.sql
006_create_checklist.sql
007_create_disputes.sql
008_create_portfolio.sql
009_create_job_board.sql
010_create_audit_log.sql
011_create_notifications.sql
012_create_reviews.sql
013_indexes_and_functions.sql  — add_xp() функция + индексы
014_add_profile_fields.sql     — bio, role, category, skills, experience
015_add_banner_url.sql
016_add_avatar_and_slides.sql  — avatar_url, slide_images JSONB
017_performance_indexes.sql
018_notifications_photo_url.sql
019_add_referrals.sql          — referral_count, referral_code
020_create_quests.sql          — quests, user_quests

## Дополнительные таблицы (создаёт admin.js при запуске)
- platform_settings — fee_percent, max_deal, maintenance_mode
- banned_users
- commission_history
- broadcast_queue

## Автомиграции
Сервер применяет все SQL из database/migrations/ при старте через _migrations таблицу.
Порядок: по имени файла (sort alphabetically).

## Модели (database/models/)
User.upsert(), User.setWallet()
Room.create()
Contract.create(), Contract.sign(), Contract.findById()
Escrow.findByContractId()
AuditLog.log()

## Статус: ЗАВЕРШЁН ✅
