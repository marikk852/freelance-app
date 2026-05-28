# SafeDeal — Руководство по деплою

## Требования
- Node.js 20+
- PostgreSQL 15+
- ffmpeg (для обработки видео/аудио)
- TON кошелёк для арбитража (ARBITRATOR_WALLET_SEED)
- Telegram Bot Token
- Домен с HTTPS (обязателен для webhook)

---

## 1. Подготовка .env

Создать `.env` в корне safedeal/:
```env
# Telegram
BOT_TOKEN=1234567890:AAF...
BOT_USERNAME=your_bot_username
WEBAPP_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/safedeal

# TON Blockchain
TON_API_KEY=your_toncenter_api_key
TON_ENDPOINT=https://toncenter.com/api/v2/
ARBITRATOR_WALLET_SEED=word1 word2 ... word24
ARBITRATOR_ADDRESS=EQA...
PLATFORM_FEE_PERCENT=2

# Security
ENCRYPTION_KEY=64_hex_chars_for_aes256_key
ADMIN_SECRET=your_admin_panel_password
ARBITRATOR_TELEGRAM_ID=your_telegram_id_for_dispute_resolution

# App
PORT=3000
NODE_ENV=production
MAX_DEAL_AMOUNT_USD=500

# Dev/Testing
SIMULATE_PAYMENTS=false  # true для тестирования без реального TON
STORAGE_PATH=/var/safedeal/storage  # путь для файлов
```

Сгенерировать ENCRYPTION_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Компиляция смарт-контракта

```bash
cd contracts
npm install
npm run build
# Результат: contracts/build/escrow.compiled.json
```

---

## 3. Backend

```bash
cd ..  # корень safedeal/
npm install  # или в backend/
node backend/server.js
```

При старте сервер автоматически:
- Подключается к PostgreSQL
- Применяет все не-применённые миграции из database/migrations/
- Инициализирует TON сервис (не падает если недоступен)
- Запускает фоновый мониторинг контрактов (monitorService)
- Запускает broadcast scheduler (каждые 60 сек)

---

## 4. Mini App

```bash
cd miniapp
npm install
npm run build
# Результат: miniapp/dist/
```

В production сервер раздаёт miniapp/dist/ как статику.
SPA fallback: все неизвестные GET запросы → index.html.

---

## 5. Telegram Bot

### Development (polling)
```bash
NODE_ENV=development node bot/bot.js
```

### Production (webhook)
Webhook устанавливается автоматически в `startBot()` если NODE_ENV=production.
Путь: `/bot{BOT_TOKEN}` — обрабатывается через Express (server.js).

Убедись что `WEBAPP_URL` указывает на доступный HTTPS домен.

---

## 6. Nginx конфигурация (пример)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 7. Railway / Render деплой

`app.set('trust proxy', 1)` уже добавлен в server.js для корректной работы rate limiting.

Railway: указать PORT и DATABASE_URL в Variables.
Команда запуска: `node backend/server.js`

---

## 8. Хранилище файлов

Создать папки (автоматически при старте, но лучше заранее):
```bash
mkdir -p /var/safedeal/storage/encrypted
mkdir -p /var/safedeal/storage/previews
mkdir -p /var/safedeal/storage/released
mkdir -p /var/safedeal/storage/banners
mkdir -p /var/safedeal/storage/avatars
mkdir -p /var/safedeal/storage/slides
```

Указать в .env: `STORAGE_PATH=/var/safedeal/storage`

---

## 9. Admin Panel

Доступен по адресу: `https://your-domain.com/admark`

Логин: пароль из `ADMIN_SECRET` в .env.
Сессия: 8 часов, токен хранится в памяти (сбрасывается при рестарте).

---

## 10. Проверка

```bash
# Healthcheck
curl https://your-domain.com/health

# Ожидаемый ответ:
# { "status": "ok", "db": true, "version": "1.0.0" }
```

---

## Режим симуляции (для тестирования)

`SIMULATE_PAYMENTS=true` — пропускает реальные TON транзакции:
- deployContract() создаёт фейковый адрес `EQS...`
- releaseEscrow() возвращает `sim_release_{timestamp}`
- refundEscrow() возвращает `sim_refund_{timestamp}`
- splitEscrow() возвращает `sim_split_{timestamp}`

Эндпоинт для тестирования полного флоу:
```
POST /api/contracts/:id/simulate-payment
```
Создаёт замороженный эскроу без реальных денег.

---

## Порядок запуска при деплое

1. Настроить .env
2. cd contracts && npm run build
3. cd miniapp && npm run build
4. Запустить PostgreSQL
5. node backend/server.js (применит миграции автоматически)
6. Проверить /health
7. Запустить bot/bot.js (или он встроен в server.js в production)
8. Открыть /admark и проверить дашборд

---

## Переменные среды — минимальный набор для dev

```env
BOT_TOKEN=...
DATABASE_URL=postgresql://localhost:5432/safedeal
ENCRYPTION_KEY=<64 hex символа>
NODE_ENV=development
SIMULATE_PAYMENTS=true
ADMIN_SECRET=admin123
ARBITRATOR_TELEGRAM_ID=<твой telegram_id>
```
