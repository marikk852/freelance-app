# Деплой SafeDeal

Репозиторий: [https://github.com/marikk852/freelance-app.git](https://github.com/marikk852/freelance-app.git)

## Что в образе

Один контейнер `app` поднимает Express API, раздачу Mini App (статика из `miniapp/dist`), webhook Telegram (в `NODE_ENV=production`), фоновый мониторинг эскроу. Перед стартом выполняется `node database/migrate.js`.

Нужны **PostgreSQL** и **Redis** (см. `docker-compose.yml`).

## Быстрый старт (Docker Compose)

1. Клонируй репозиторий и создай `.env` из `.env.example`.
2. Укажи как минимум: `BOT_TOKEN`, `WEBAPP_URL` (публичный HTTPS, совпадает с URL Mini App в BotFather), `ENCRYPTION_KEY`, `JWT_SECRET`, ключи TON и арбитра.
3. В `WEBAPP_URL` укажи тот же базовый URL, по которому открывается фронт (например `https://api.example.com` если всё на одном домене).
4. Запуск:

```bash
docker compose up -d --build
```

5. Убедись, что Telegram видит **HTTPS**. Для тестов можно использовать туннель (ngrok, cloudflared) и прописать выданный URL в `WEBAPP_URL` и в настройках бота.

## Переменные для фронта

- Если API и Mini App на **одном origin** (как в Docker-образе), `VITE_API_URL` можно не задавать — клиент ходит на `/api`.
- Если фронт на другом домене, пересобери образ с аргументом:

```bash
docker build --build-arg VITE_API_URL=https://api.example.com/api -t safedeal .
```

## Публикация в GitHub

```bash
git init
git remote add origin https://github.com/marikk852/freelance-app.git
git add .
git commit -m "Initial commit: SafeDeal"
git branch -M main
git push -u origin main
```

Перед пушем убедись, что **нет** файла `.env` в коммите (он в `.gitignore`).

## Альтернативы хостингу

- **Railway / Render / Fly.io**: подключи репозиторий, задай переменные окружения, для БД используй managed PostgreSQL и Redis.
- **VPS**: установи Docker, подними `docker compose`, перед доменом поставь reverse proxy (Caddy/nginx) с TLS.

## Проверка

- `GET /health` — статус API и БД.
- После деплоя в BotFather укажи URL Mini App = твой `WEBAPP_URL`.
