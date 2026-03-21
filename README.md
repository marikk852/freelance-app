# SafeDeal

> Telegram Mini App для безопасных сделок между фрилансерами и клиентами.
> Децентрализованная эскроу система на смарт-контрактах TON блокчейна.

## Ключевая идея

Мы **не** держим чужие деньги. Деньги заморожены в смарт-контракте на блокчейне TON.
Мы — технологический интерфейс. Работает без юрлица (как Uniswap).

## Стек

| Слой | Технологии |
|------|-----------|
| Блокчейн | FunC, @ton/blueprint, @ton/sandbox |
| Backend | Node.js 20, Express.js, PostgreSQL 15, Redis |
| Bot | Telegraf 4.x |
| Frontend | React 18, Vite, Telegram Web App SDK |
| Файлы | sharp, ffmpeg, pdf-lib, xlsx |
| Шифрование | AES-256-CBC |

## Структура проекта

```
safedeal/
├── agents/          # Инструкции для каждого AI агента
├── contracts/       # TON смарт-контракты (FunC) + тесты
├── bot/             # Telegram бот (Telegraf)
├── backend/         # Express API + сервисы
├── database/        # Миграции, модели PostgreSQL
├── miniapp/         # React фронтенд (9 экранов)
└── storage/         # Зашифрованные файлы, превью, релизы
```

## Быстрый старт

### 1. Установка зависимостей

```bash
# Root
npm install

# Backend
cd backend && npm install

# Contracts
cd contracts && npm install

# Mini App
cd miniapp && npm install
```

### 2. Настройка окружения

```bash
cp .env.example .env
# Заполни все переменные в .env
```

### 3. База данных

```bash
# Запусти PostgreSQL
# Выполни миграции
cd backend && npm run migrate
```

### 4. Запуск в dev режиме

```bash
# Backend API (порт 3000)
npm run dev:backend

# Telegram бот
npm run dev:bot

# Mini App (порт 5173)
npm run dev:miniapp
```

### 5. Сборка контрактов

```bash
cd contracts && npm run build
npm run test:contracts
```

## Финансовая модель

- Комиссия: **2%** (автоматически в смарт-контракте)
- Лимит сделки MVP: **$500**
- При `release`: 98% → фрилансер, 2% → платформа
- При `refund`: 100% → клиент
- При `split`: арбитр задаёт процент

## Флоу сделки

```
Клиент создаёт заказ
    → invite_link → фрилансер принимает
    → оба подписали → деплой контракта
    → клиент отправляет TON/USDT на адрес контракта
    → деньги заморожены → фрилансер начинает работу
    → загрузка файлов → защищённое превью клиенту
    → клиент проверяет по чек-листу
    → APPROVE → release() → 98% фрилансеру
    → отзывы → рейтинг → портфолио
```

## Безопасность

- Приватные ключи только в `.env` (никогда в коде)
- AES-256-CBC шифрование всех файлов до release
- release/refund/split ТОЛЬКО от ARBITRATOR_ADDRESS
- Все финансовые операции логируются в `audit_log`
- Контракт уничтожается после release/refund

## Команда агентов

| Агент | Зона |
|-------|------|
| Агент 1 — Архитектор | Структура, конфиги |
| Агент 2 — Блокчейн | TON смарт-контракт |
| Агент 3 — БД | PostgreSQL миграции |
| Агент 4 — Эскроу | Backend ↔ контракт |
| Агент 5 — Файлы | Защита и шифрование |
| Агент 6 — Бот | Telegram Telegraf |
| Агент 7 — Mini App | React 9 экранов |
| Агент 8 — Тестировщик | Безопасность |

## Лицензия

MIT
