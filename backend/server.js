require('dotenv').config({ path: '../.env' });

const path       = require('path');
const fs         = require('fs');
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { healthCheck } = require('../database/db');
const tonService = require('./services/tonService');
const { startMonitoring } = require('./services/monitorService');
const { authMiddleware } = require('./middleware/auth');

// ============================================================
// SafeDeal Backend — Express API Server
// ============================================================

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware безопасности ----------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://telegram.org', 'https://*.telegram.org'],
      styleSrc:  ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:   ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:    ["'self'", 'data:', 'https:'],
      connectSrc:["'self'", 'https:'],
    },
  },
}));
const allowedOrigins = process.env.WEBAPP_URL
  ? [process.env.WEBAPP_URL]
  : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000']);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (bot, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Не разрешён политикой CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting: 100 запросов за 15 минут с одного IP
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Слишком много запросов, попробуйте позже' },
}));

// ---------- Статика (превью — публичные, без авторизации) ----------
// Превью защищены watermark-ом, оригиналы никогда не отдаются напрямую
app.use('/previews', express.static(
  require('path').join(__dirname, '../storage/previews'),
  { maxAge: '1h' }
));

// ---------- Публичные маршруты ----------

/**
 * GET /health
 * Проверка работоспособности сервера и БД.
 */
app.get('/health', async (req, res) => {
  const dbOk = await healthCheck();
  res.json({
    status  : dbOk ? 'ok' : 'degraded',
    db      : dbOk,
    version : '1.0.0',
  });
});

// ---------- Защищённые маршруты (требуют Telegram initData) ----------
app.use('/api/', authMiddleware);

app.use('/api/contracts',  require('./routes/contracts'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/disputes',   require('./routes/disputes'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/jobs',       require('./routes/jobs'));
app.use('/api/marketing',  require('./routes/marketing'));

// ---------- Webhook для бота (production) ----------
if (process.env.NODE_ENV === 'production') {
  try {
    const bot         = require('../bot/bot');
    const webhookPath = `/bot${process.env.BOT_TOKEN}`;
    app.use(bot.webhookCallback(webhookPath));
    console.log('[Server] Webhook бота подключён');
  } catch { /* бот не запущен отдельно */ }
}

// ---------- Mini App (SPA) — production, один origin с /api ----------
const miniappDist = path.join(__dirname, '../miniapp/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(miniappDist)) {
  app.use(express.static(miniappDist, { maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (
      req.path.startsWith('/api')
      || req.path.startsWith('/previews')
      || req.path === '/health'
      || req.path.startsWith('/bot')
    ) {
      return next();
    }
    res.sendFile(path.join(miniappDist, 'index.html'), err => {
      if (err) res.status(404).json({ error: 'Mini App not built' });
    });
  });
}

// ---------- Обработка 404 ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// ---------- Глобальная обработка ошибок ----------
app.use((err, req, res, next) => {
  console.error('[Server] Необработанная ошибка:', err.message);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ---------- Запуск ----------
async function start() {
  // Проверяем БД
  const dbOk = await healthCheck();
  if (!dbOk) {
    console.error('[Server] ОШИБКА: Не удалось подключиться к PostgreSQL');
    process.exit(1);
  }
  console.log('[Server] ✅ PostgreSQL подключён');

  // Инициализируем TON клиент
  try {
    await tonService.init();
    console.log('[Server] ✅ TON сервис инициализирован');
  } catch (err) {
    console.error('[Server] ⚠️  TON сервис недоступен:', err.message);
    // Не крашим — продолжаем без блокчейна в dev режиме
  }

  // Запускаем фоновый мониторинг
  startMonitoring();

  // Старт HTTP сервера
  app.listen(PORT, () => {
    console.log(`[Server] 🚀 SafeDeal API запущен на порту ${PORT}`);
    console.log(`[Server] Режим: ${process.env.NODE_ENV || 'development'}`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('[Server] Критическая ошибка запуска:', err.message);
    process.exit(1);
  });
}

module.exports = app;
