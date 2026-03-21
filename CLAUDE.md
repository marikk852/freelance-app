# SafeDeal — Полный контекст проекта для ИИ агентов

## Что такое SafeDeal
Telegram Mini App для безопасных сделок между фрилансерами и клиентами.
Децентрализованная эскроу система на смарт-контрактах TON блокчейна.
Платформа работает БЕЗ юрлица на старте — мы не кастодианы, мы технологический интерфейс.
Главный герой платформы — КЛИЕНТ.

## Ключевые решения

### Финансовая модель
- Смарт-контракты на TON (НЕ кастодиальное хранение)
- Валюты MVP: TON + jUSDT. BTC — версия 2.0
- Комиссия: 2% в смарт-контракте, уходит автоматически
- Лимит сделки на старте: $500 (вместо аудита)
- Арбитр: кошелёк платформы (ARBITRATOR_ADDRESS из .env)
- Основа: готовый открытый эскроу контракт + минимальные изменения

### Почему смарт-контракт
Кастодиальный = держим чужие деньги = нужна лицензия.
Смарт-контракт = деньги в блокчейне = мы только UI = работаем без юрлица.
Модель как Uniswap — технологическая платформа.

### Путь денег (USDT пример)
1. Клиент выбирает USDT
2. Backend деплоит новый экземпляр смарт-контракта с уникальным deal_id
3. Клиент отправляет jUSDT на адрес контракта
4. Контракт замораживает средства
5. При approve: контракт отправляет 98% фрилансеру + 2% платформе
6. Всё в блокчейне навсегда

## Стек технологий

Блокчейн: FunC (TON смарт-контракты) + @ton/blueprint + @ton/sandbox + @ton/ton
Backend: Node.js 20 + Express.js + PostgreSQL 15 + Redis
Bot: Telegraf 4.x
Frontend: React 18 + Telegram Web App SDK
Файлы: sharp + fluent-ffmpeg + pdf-lib + xlsx
Шифрование: AES-256-CBC

## Структура папок

safedeal/
├── CLAUDE.md
├── agents/
│   ├── architect.md
│   ├── blockchain.md
│   ├── database.md
│   ├── escrow.md
│   ├── files.md
│   ├── bot.md
│   ├── miniapp.md
│   └── tester.md
├── contracts/
│   ├── escrow.fc
│   ├── escrow.spec.ts
│   └── wrappers/
├── bot/
│   ├── bot.js
│   ├── handlers/
│   └── keyboards/
├── backend/
│   ├── server.js
│   ├── routes/
│   └── services/
│       ├── tonService.js
│       ├── escrowService.js
│       ├── fileProtection.js
│       └── notificationService.js
├── database/
│   ├── db.js
│   ├── migrations/
│   └── models/
├── miniapp/
│   └── src/
│       ├── pages/
│       └── components/
└── storage/
    ├── encrypted/
    ├── previews/
    └── released/

## База данных

users: id, telegram_id, username, ton_wallet_address, rating, deals_count, level, xp, streak_days, safe_coins, is_verified, created_at
rooms: id UUID, invite_link, status(waiting|active|completed|disputed|cancelled), client_id, freelancer_id, created_at, closed_at
contracts: id UUID, room_id, title, description, amount_usd, currency(TON|USDT), crypto_amount, deadline, criteria JSONB, status, signed_by_client, signed_by_freelancer, ton_contract_address, created_at
escrow: id UUID, contract_id, currency, amount, platform_fee, status(waiting_payment|frozen|released|refunded), ton_contract_address, tx_hash_in, tx_hash_out, frozen_at, released_at
deliveries: id UUID, contract_id, description, files JSONB, links JSONB, status(submitted|reviewing|approved|rejected), submitted_at, review_comment
checklist_items: id UUID, contract_id, criterion, is_checked, checked_at, comment
disputes: id UUID, contract_id, opened_by, reason, client_evidence JSONB, freelancer_evidence JSONB, status(open|reviewing|resolved), decision(client_wins|freelancer_wins|split), split_percent, resolved_at
portfolio_items: id UUID, freelancer_id, contract_id, title, description, preview_url, tags JSONB, is_visible, created_at
job_posts: id UUID, client_id, title, description, budget_min, budget_max, currency, deadline, category, skills_required JSONB, status(open|in_review|closed|taken), created_at, expires_at
job_applications: id UUID, job_post_id, freelancer_id, cover_letter, proposed_amount, status(pending|accepted|rejected), created_at
audit_log: id UUID, contract_id, action, performed_by, details JSONB, tx_hash, created_at
notifications: id UUID, user_id, type, message, is_read, created_at

## Смарт-контракт TON — что реализовать

Функции:
- init(client_addr, freelancer_addr, arbitrator_addr, amount, fee_percent, deadline)
- deposit() — клиент отправляет TON или jUSDT
- release() — ТОЛЬКО арбитр, при delivery_approved
- refund() — ТОЛЬКО арбитр, при отмене
- split(freelancer_percent) — арбитр при споре
- get_state() — читает статус

Правила:
- release/refund/split ТОЛЬКО от ARBITRATOR_ADDRESS
- После release/refund контракт уничтожается
- Таймаут: дедлайн прошёл без действий = авто-refund
- Максимум $500 эквивалент

Тесты обязательны для:
- Нормальное закрытие сделки
- Возврат при просрочке
- Спор и split
- Попытка украсть (должна провалиться)
- Попытка вызвать release не арбитром (должна провалиться)

## Полный флоу сделки

1. Клиент создаёт заказ (название, описание, сумма, дедлайн, минимум 3 критерия)
2. Генерируется invite_link → клиент отправляет фрилансеру в Telegram
3. Фрилансер открывает ссылку → видит контракт → принимает
4. Оба подписали → выбор валюты TON или USDT
5. Backend деплоит новый смарт-контракт для этой сделки
6. Клиент получает адрес контракта → отправляет крипту (через @wallet или Tonkeeper)
7. Backend мониторит контракт → при получении денег статус = frozen
8. Уведомление клиенту: "Деньги заморожены" / фрилансеру: "Начинай работу"
9. Фрилансер загружает файлы → backend создаёт защищённое превью
10. Клиент проверяет превью по чек-листу критериев из контракта
11a. Принял → backend вызывает release() → 98% фрилансеру + 2% платформе
11b. Правки → фрилансер исправляет → повторная проверка
11c. Спор → backend вызывает split() или refund()
12. Оба оставляют отзыв → рейтинг + XP
13. Работа попадает в портфолио фрилансера (только реально закрытые)

## Защита файлов

Фото (jpg,png,webp): водяной знак + resize 400px (sharp)
Видео (mp4,mov): 360p + водяной знак (ffmpeg)
PDF: только страница 1 (pdf-lib)
Excel/CSV: заголовки видны, данные = *** (xlsx)
Код (js,ts,py,etc): первые 35% строк
Аудио (mp3,wav): первые 30 секунд (ffmpeg)
Архивы (zip): только список файлов

Хранение:
storage/encrypted/ — AES-256-CBC оригинал (никогда не отдаём до release)
storage/previews/ — защищённое превью для клиента
storage/released/ — разблокированный оригинал (24ч временная ссылка)

## Дизайн система

Стиль: Pixel Art + Liquid Glass, чёрный фон #000000
Шрифт: Press Start 2P

Цвета:
#00FF88 — зелёный (успех, принято, основной)
#FFAA00 — золотой (XP, монеты, оплата)
#0088FF — синий (заморожено)
#CC44FF — фиолетовый (на проверке)
#FF4466 — красный (спор, опасность)
#FF8800 — оранжевый (ожидание)

Glass карточки:
background: rgba(255,255,255,0.045)
border: 1px solid rgba(255,255,255,0.13)
border-radius: 20px большие / 14px малые / 100px пилюли
pixel grid overlay: 5x5px rgba(255,255,255,0.018)
shimmer animation на всех карточках

Пиксельные сцены (Canvas API) на каждом экране:
HOME → дом + свиток квестов
NEW DEAL → перо пишет контракт
DEAL ROOM → два персонажа + сейф между ними
PAYMENT → монеты летят по дуге в сейф
REVIEW → лупа над чеклистом + большая галочка
DISPUTE → весы правосудия + молоток
LIVE DEALS → антенна с волнами + карточки летят вверх
PROFILE → пиксельный персонаж + трофеи + звёзды рейтинга
JOB BOARD → доска объявлений + лупа + карточки заказов

Геймификация:
- Уровень (LVL) = количество закрытых сделок / 2
- XP: +50 создание сделки, +200 закрытие, +25 отзыв, +10 ежедневный вход
- SafeCoins: внутренняя валюта за активность
- Streak: серия дней подряд
- Рейтинг: только из реально закрытых сделок, нельзя накрутить

## Все экраны (9 штук)

01. HOME — главная, активные сделки, статистика, кнопка нового квеста
02. NEW DEAL — создание контракта, 5 шагов с прогресс баром
03. DEAL ROOM — комната сделки, сейф, квест лог, кнопки действий
04. PAYMENT — выбор валюты TON/USDT, адрес контракта, разбивка суммы
05. REVIEW — чек-лист критериев, превью файлов, три кнопки решения
06. DISPUTE — причина, доказательства, варианты решения
07. LIVE DEALS — лента сделок в реальном времени, реклама, фильтры
08. PROFILE — аватар, статистика, кошелёк, портфолио, отзывы
09. JOB BOARD — биржа заказов, фильтры, публикация заказа, отклики

## .env переменные

BOT_TOKEN=
WEBAPP_URL=
DATABASE_URL=
REDIS_URL=
TON_API_KEY=
TON_ENDPOINT=https://toncenter.com/api/v2/
ARBITRATOR_WALLET_SEED=
ARBITRATOR_ADDRESS=
PLATFORM_FEE_PERCENT=2
ENCRYPTION_KEY=
PORT=3000
MAX_DEAL_AMOUNT_USD=500

## Агенты и порядок запуска

Агент 1 — АРХИТЕКТОР
Задача: структура папок, package.json, .env.example, README.md
Запускать ПЕРВЫМ

Агент 2 — БЛОКЧЕЙН ИНЖЕНЕР (критически важный)
Задача: TON смарт-контракт на FunC + тесты + TypeScript обёртки + деплой скрипт
Инструменты: @ton/blueprint, @ton/sandbox, @ton/ton
Взять готовый открытый эскроу контракт как основу, изменить минимально

Агент 3 — ИНЖЕНЕР БД
Задача: все SQL миграции, db.js подключение, модели

Агент 4 — ЭСКРОУ СЕРВИС
Задача: backend взаимодействие с TON контрактом
deployContract(), monitorContract(), releaseEscrow(), refundEscrow(), splitEscrow()

Агент 5 — ФАЙЛОВЫЙ ИНЖЕНЕР
Задача: защита всех типов файлов при сдаче работы

Агент 6 — TELEGRAM BOT
Задача: полный флоу сделки через команды бота
Использует готовые сервисы агентов 4 и 5

Агент 7 — MINI APP
Задача: React фронтенд все 9 экранов
Строго соблюдать дизайн систему выше
Пиксельные сцены через Canvas API

Агент 8 — ТЕСТИРОВЩИК
Задача: тесты безопасности смарт-контракта и всей логики

## Правила для всех агентов

1. Прочитать CLAUDE.md полностью перед началом
2. Работать только в своей зоне
3. Комментарии к каждой функции
4. Обработка ошибок везде
5. ВСЕ финансовые операции логировать в audit_log
6. Приватные ключи ТОЛЬКО в .env
7. После завершения написать: "Агент N завершил. Передаю Агенту N+1."

## Текущий статус

ГОТОВО:
- Концепция и позиционирование
- Финансовая модель (смарт-контракты TON без юрлица)
- Дизайн 7 экранов
- Логотип (пиксельный рыцарь, зелёный + золотой)
- Полная схема БД
- Архитектура агентов

В РАЗРАБОТКЕ:
- TON смарт-контракт
- Все 9 экранов Mini App
- Backend сервисы
- Telegram бот
- Деплой
