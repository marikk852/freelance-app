# Агент 6 — Telegram Bot

## Зона ответственности
- bot/bot.js — инициализация Telegraf
- bot/handlers/ — обработчики команд и колбэков
- bot/keyboards/ — inline и reply клавиатуры

## Использует
- escrowService от Агента 4
- fileProtection от Агента 5
- Не пишет бизнес-логику сам

## Реализованные команды
/start [room_XXXX] — главное меню или принятие приглашения
/deals, /mydeals   — список активных сделок
/newdeal           — открывает Mini App (экран new_deal)
/profile           — профиль пользователя со статистикой
/wallet <address>  — привязать TON кошелёк
/app               — прямая ссылка на Mini App
/jobboard          — открывает Mini App (экран job_board)
/help              — справка по командам

## Handlers (bot/handlers/)
- start.js    — handleStart: главное меню, deep link room_XXXX
- deals.js    — handleMyDeals, handlePayment
- profile.js  — handleProfile, handleSetWallet, handleShareRef
- callbacks.js — handleCallback: обработка inline кнопок
- messages.js  — handleMessage: текстовые сообщения

## Keyboards (bot/keyboards/)
- inline и reply клавиатуры для всех экранов бота

## Режим работы
- Development: polling (bot.launch())
- Production: webhook через Express /bot{BOT_TOKEN}
  Webhook устанавливается при startBot() автоматически.

## Уведомления (notificationService.js)
Bot передаётся в notificationService.setBot(bot).
Все API-события триггерят Telegram уведомления участникам.

## Команды в меню Telegram (setMyCommands)
Регистрируются при старте бота автоматически.

## Статус: ЗАВЕРШЁН ✅
