# SafeDeal — REST API Reference

## Аутентификация

Все защищённые эндпоинты требуют заголовок с Telegram initData:
```
Authorization: tma <initData>
```
Middleware: `backend/middleware/auth.js` — проверяет подпись HMAC-SHA256.

## Публичные маршруты

### GET /health
Проверка работоспособности сервера и БД.
```json
{ "status": "ok", "db": true, "version": "1.0.0" }
```

### GET /admark/status
Статус платформы (maintenance mode). Вызывается Mini App при старте.
```json
{ "maintenance": false, "message": "" }
```

### GET /api/rooms/join/:inviteLink
Получить информацию о комнате по invite-ссылке (UUID).
Используется фрилансером при открытии ссылки. **Без авторизации**.
```json
{
  "contract_id": "uuid",
  "title": "string",
  "description": "string",
  "amount_usd": 100,
  "currency": "TON|USDT",
  "deadline": "ISO date",
  "criteria": [...],
  "status": "string",
  "room_status": "waiting|active|completed",
  "client_first_name": "string",
  "client_username": "string"
}
```

---

## /api/contracts

### POST /api/contracts
Создать контракт (только клиент). Клиент автоматически подписывает при создании. +50 XP.

Body:
```json
{
  "title": "min 3, max 256",
  "description": "min 10",
  "amount_usd": "positive, max 500",
  "currency": "TON|USDT",
  "deadline": "future date",
  "criteria": [{ "text": "string", "required": true }, ...]  // min 3
}
```
Response 201:
```json
{
  "contractId": "uuid",
  "roomId": "uuid",
  "inviteLink": "uuid",
  "inviteUrl": "https://t.me/bot?start=room_UUID"
}
```

### GET /api/contracts/:id
Получить контракт с данными эскроу. Только участники сделки.
```json
{
  "id": "uuid",
  "title": "string",
  "status": "signed|awaiting_payment|in_progress|under_review|completed|disputed",
  "escrow_status": "waiting_payment|frozen|released|refunded",
  "tx_hash_in": "string|null",
  "frozen_at": "timestamp|null",
  ...
}
```

### POST /api/contracts/:id/sign
Подписать контракт.

Body: `{ "role": "client|freelancer" }`

Безопасность:
- Только реальный клиент может подписать как client
- Клиент НЕ может подписать как freelancer

### POST /api/contracts/:id/deploy
Деплоить смарт-контракт на TON. Требует: оба подписали.

Body:
```json
{
  "clientWallet": "UQ...|EQ...",
  "freelancerWallet": "UQ...|EQ..."
}
```
Response: `{ "tonContractAddress": "EQ...", "cryptoAmount": 1.23 }`

### POST /api/contracts/:id/approve
Клиент принимает работу. Триггерит releaseEscrow(). Только клиент контракта.

Response: `{ "success": true, "txHash": "hex" }`

### POST /api/contracts/:id/simulate-payment
**Только SIMULATE_PAYMENTS=true.** Имитирует заморозку эскроу для тестирования.

---

## /api/deliveries

### POST /api/deliveries
Фрилансер сдаёт работу. Multipart форма. Только назначенный фрилансер.

Body (form-data):
- `contractId` — UUID контракта
- `description` — описание (опционально)
- `links` — JSON массив ссылок (опционально)
- `files` — до 10 файлов (max 100 MB каждый)

Файлы шифруются (AES-256-CBC) и создаются превью.
Триггерит уведомление клиенту.

Response 201:
```json
{
  "deliveryId": "uuid",
  "filesProcessed": 2,
  "previewUrls": [{ "fileId": "uuid", "name": "file.jpg", "type": "image", "preview": "/api/deliveries/preview/uuid" }]
}
```

### GET /api/deliveries/preview/:fileId
Получить превью файла. Только участники контракта.
Возвращает файл напрямую (sendFile).

### GET /api/deliveries/download/:fileId
Скачать оригинальный файл. Только после `delivery.status = 'approved'`. Только участники.
Расшифровывает AES-256-CBC и возвращает оригинал.

### GET /api/deliveries/by-contract/:contractId
Получить последнюю сдачу работы по контракту.

### GET /api/deliveries/:id
Получить конкретную сдачу работы.

### POST /api/deliveries/:id/approve
Клиент принимает работу. Только клиент контракта.
- Обновляет delivery.status='approved'
- Обновляет contract.status='completed'
- Триггерит releaseEscrow()
- Разблокирует файлы (releaseFiles)
- Создаёт запись в portfolio_items
- +200 XP клиенту и фрилансеру

Response: `{ "success": true, "txHash": "string" }`

### POST /api/deliveries/:id/reject
Клиент отклоняет работу. Только клиент контракта.

Body: `{ "comment": "причина" }`
- Обновляет delivery.status='rejected'
- Возвращает contract.status='in_progress'
- Триггерит уведомление фрилансеру

---

## /api/disputes

### POST /api/disputes
Открыть спор. Только участник сделки. Статус контракта: in_progress или under_review.

Body:
```json
{
  "contractId": "uuid",
  "reason": "string",
  "evidence": { "..." }  // опционально
}
```

### POST /api/disputes/:id/resolve
Разрешить спор. Только ARBITRATOR_TELEGRAM_ID.

Body:
```json
{
  "decision": "client_wins|freelancer_wins|split",
  "splitPercent": 60  // только для decision=split, 0-100
}
```
- client_wins → refundEscrow()
- freelancer_wins → splitEscrow(100)
- split → splitEscrow(splitPercent)

---

## /api/users

### GET /api/users/me
Профиль текущего пользователя. Авто-регистрация при первом открытии Mini App.
Возвращает все поля включая bio, role, skills, wallet, XP, SafeCoins, streak.

### GET /api/users/me/deals
Все сделки текущего пользователя (как клиент + как фрилансер).
```json
{ "as_client": [...], "as_freelancer": [...], "total": 5 }
```

### PATCH /api/users/me/profile
Обновить расширенный профиль.

Поля: bio (max 300), role (client|freelancer|both), category (design|dev|writing|video|marketing|other),
skills (array, max 15, каждый max 30), experience (junior|middle|senior),
account_type (individual|company), company_name, company_url, country, portfolio_url, github_url

### PATCH /api/users/me/wallet
Привязать TON кошелёк.

Body: `{ "walletAddress": "UQ...|EQ...|kQ...|0Q..." }`

### POST /api/users/me/banner
Загрузить баннер профиля. Multipart: поле `banner`. Resize 900x300 JPEG.

### POST /api/users/me/avatar
Загрузить аватар. Multipart: поле `avatar`. Resize 400x400 JPEG.

### POST /api/users/me/slides
Добавить слайд (max 5). Multipart: поле `slide`. Resize 900x500 JPEG.

### DELETE /api/users/me/slides/:index
Удалить слайд по индексу 0–4.

### GET /api/users/freelancers
Список фрилансеров с заполненным профилем. Сортировка по рейтингу. Лимит 50.

### GET /api/users/:telegramId
Публичный профиль пользователя.

### GET /api/users/:telegramId/portfolio
Портфолио фрилансера (только is_visible=true, только реально закрытые сделки).

### GET /api/users/:telegramId/reviews
Отзывы о пользователе.

---

## /api/jobs

### GET /api/jobs
Список открытых вакансий. Фильтры: category, currency, search. Limit/offset.

### POST /api/jobs
Создать вакансию.

Body:
```json
{
  "title": "min 5, max 256",
  "description": "min 20",
  "budget_min": 0,
  "budget_max": 500,
  "currency": "TON|USDT",
  "deadline": 30,  // дней
  "category": "string",
  "skills_required": ["string"]
}
```

### GET /api/jobs/my
Мои вакансии (как клиент) с количеством откликов.

### GET /api/jobs/:id/applications
Список откликов на вакансию. Только владелец вакансии.

### POST /api/jobs/:id/apply
Откликнуться на вакансию. Только фрилансер (один раз).

Body: `{ "cover_letter": "string", "proposed_amount": 150 }`

---

## /api/livefeed

### GET /api/livefeed
Лента сделок в реальном времени + статистика платформы.
```json
{
  "stats": { "completed": 42, "volume": 5200.50, "active": 8, "disputes": 1 },
  "events": [{ "id": "uuid", "title": "...", "amount": 100, "currency": "USDT", "type": "completed|frozen|new|disputed", "time": "..." }]
}
```

---

## /api/notifications

### GET /api/notifications
Последние 50 уведомлений текущего пользователя.

### GET /api/notifications/unread-count
Количество непрочитанных уведомлений. `{ "count": 3 }`

### PATCH /api/notifications/read-all
Отметить все как прочитанные.

### PATCH /api/notifications/:id/read
Отметить одно уведомление как прочитанное.

---

## /api/quests

### GET /api/quests
Все активные квесты с статусом выполнения. Автоматически завершает подходящие квесты.
```json
{
  "quests": [{ "key": "link_wallet", "title": "...", "coins": 50, "completed": true, "completed_at": "..." }],
  "newlyCompleted": [{ "key": "...", "title": "...", "coins": 50 }]
}
```

### POST /api/quests/:key/claim
Вручную заявить награду за квест.
```json
{ "success": true, "coins": 50, "totalCoins": 350 }
```

---

## /api/marketing (только ARBITRATOR_TELEGRAM_ID)

### POST /api/marketing/strategy
Генерация маркетинговой стратегии (Claude AI).
Body: `{ "goal": "string", "channel": "telegram|twitter|reddit|product_hunt|referral|content", "audience": "..." }`

### POST /api/marketing/content
Генерация контента (Claude AI).
Body: `{ "type": "telegram_post|cold_dm|reddit_post|landing_tagline|ad_copy", "context": "...", "language": "..." }`

### GET /api/marketing/growth
Анализ метрик роста и рекомендации (Claude AI).

---

## Admin Panel (/admark) — защита паролем ADMIN_SECRET

### GET /admark/
HTML-страница панели администратора.

### POST /admark/login
Body: `{ "password": "..." }` → `{ "token": "hex" }`
Брутфорс-защита: 10 попыток за 15 минут. Сессия 8 часов.

Все /admark/api/* требуют заголовок: `X-Admin-Token: <token>`

### GET /admark/api/stats — дашборд
### GET /admark/api/analytics — аналитика, воронка конверсий
### GET /admark/api/monitoring — застрявшие сделки, просроченные дедлайны
### GET /admark/api/users — список пользователей с поиском
### GET /admark/api/users/:tgId/history — история сделок пользователя
### POST /admark/api/users/:tgId/ban — забанить
### DELETE /admark/api/users/:tgId/ban — разбанить
### POST /admark/api/users/:tgId/reward — выдать XP/SafeCoins
### GET /admark/api/contracts — список контрактов с фильтром
### PATCH /admark/api/contracts/:id — изменить статус контракта
### GET /admark/api/disputes — открытые споры
### POST /admark/api/disputes/:id/resolve — разрешить спор
### GET /admark/api/finance — финансовая отчётность
### GET /admark/api/export/contracts — CSV экспорт
### GET /admark/api/settings — настройки платформы
### POST /admark/api/settings — обновить настройки (fee, max_deal, maintenance_mode)
### GET /admark/api/jobs — все вакансии
### DELETE /admark/api/jobs/:id — удалить вакансию
### POST /admark/api/broadcast — отправить рассылку (сегмент или конкретные пользователи)
### GET /admark/api/broadcast/queue — очередь запланированных рассылок
### DELETE /admark/api/broadcast/queue/:id — отменить рассылку

---

## Rate Limiting
- /api/* — 100 запросов за 15 минут с одного IP
- /admark/login — 10 попыток за 15 минут с одного IP
