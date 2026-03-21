require('dotenv').config({ path: '../.env' });

const { Telegraf, session } = require('telegraf');
const { handleStart }    = require('./handlers/start');
const { handleMyDeals, handlePayment } = require('./handlers/deals');
const { handleProfile, handleSetWallet } = require('./handlers/profile');
const { handleCallback } = require('./handlers/callbacks');
const { handleMessage }  = require('./handlers/messages');
const notificationService = require('../backend/services/notificationService');

// ============================================================
// SafeDeal Telegram Bot
// Агент 6: инициализация и регистрация всех обработчиков
// ============================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('[Bot] ОШИБКА: BOT_TOKEN не задан в .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ---- Session (для multi-step флоу) ----
bot.use(session());

// ---- Middleware: регистрация пользователя при каждом запросе ----
bot.use(async (ctx, next) => {
  // Инициализируем сессию
  ctx.session = ctx.session || {};

  // Логируем входящие сообщения в dev режиме
  if (process.env.NODE_ENV !== 'production') {
    const type = ctx.updateType;
    const from = ctx.from?.username || ctx.from?.id;
    if (type !== 'callback_query') {
      console.log(`[Bot] ${type} от @${from}: ${ctx.message?.text?.slice(0, 50) || ''}`);
    }
  }

  return next();
});

// ---- Команды ----

/**
 * /start [room_XXXX]
 * Главное меню или принятие приглашения в сделку
 */
bot.command('start', handleStart);

/**
 * /deals — список активных сделок
 */
bot.command('deals', handleMyDeals);
bot.command('mydeals', handleMyDeals);

/**
 * /profile — профиль пользователя
 */
bot.command('profile', handleProfile);

/**
 * /wallet <address> — привязать TON кошелёк
 */
bot.command('wallet', handleSetWallet);

/**
 * /newdeal — создать сделку (открывает Mini App)
 */
bot.command('newdeal', async (ctx) => {
  await ctx.reply(
    '⚔️ Создай новую сделку в приложении:',
    {
      reply_markup: {
        inline_keyboard: [[{
          text   : '✍️ Создать сделку',
          web_app: { url: `${process.env.WEBAPP_URL}?screen=new_deal` },
        }]],
      },
    }
  );
});

/**
 * /jobboard — биржа заказов (открывает Mini App)
 */
bot.command('jobboard', async (ctx) => {
  await ctx.reply(
    '📌 Биржа заказов:',
    {
      reply_markup: {
        inline_keyboard: [[{
          text   : '🔍 Открыть биржу',
          web_app: { url: `${process.env.WEBAPP_URL}?screen=job_board` },
        }]],
      },
    }
  );
});

/**
 * /help — справка по командам
 */
bot.command('help', async (ctx) => {
  await ctx.reply(
    `🛡 *SafeDeal — Справка*\n\n` +
    `/start — Главное меню\n` +
    `/deals — Мои сделки\n` +
    `/newdeal — Создать сделку\n` +
    `/profile — Профиль и статистика\n` +
    `/wallet <адрес> — Привязать TON кошелёк\n` +
    `/jobboard — Биржа заказов\n` +
    `/help — Эта справка\n\n` +
    `❓ Поддержка: @safedeal_support`,
    { parse_mode: 'Markdown' }
  );
});

// ---- Callback Query (нажатия inline-кнопок) ----
bot.on('callback_query', handleCallback);

// ---- Текстовые сообщения (multi-step флоу) ----
bot.on('text', handleMessage);

// ---- Обработка ошибок бота ----
bot.catch((err, ctx) => {
  console.error(`[Bot] Ошибка для ${ctx.updateType}:`, err.message);
  ctx.reply('Произошла ошибка. Попробуй ещё раз.').catch(() => {});
});

// ---- Передаём bot в notificationService ----
notificationService.setBot(bot);

// ---- Запуск ----
async function startBot() {
  // Устанавливаем команды в меню Telegram
  await bot.telegram.setMyCommands([
    { command: 'start',    description: 'Главное меню' },
    { command: 'deals',    description: 'Мои сделки' },
    { command: 'newdeal',  description: 'Создать сделку' },
    { command: 'profile',  description: 'Профиль' },
    { command: 'wallet',   description: 'Привязать TON кошелёк' },
    { command: 'jobboard', description: 'Биржа заказов' },
    { command: 'help',     description: 'Помощь' },
  ]);

  // Запускаем polling (для dev) или webhook (для prod)
  if (process.env.NODE_ENV === 'production' && process.env.WEBAPP_URL) {
    const webhookPath = `/bot${BOT_TOKEN}`;
    const webhookUrl  = `${process.env.WEBAPP_URL}${webhookPath}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`[Bot] Webhook установлен: ${webhookUrl}`);
    // Webhook обрабатывается через Express (см. server.js)
  } else {
    await bot.launch();
    console.log('[Bot] 🤖 SafeDeal бот запущен (polling mode)');
  }
}

startBot().catch(err => {
  console.error('[Bot] Ошибка запуска:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
