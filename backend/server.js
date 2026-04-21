require('dotenv').config({ path: '../.env' });

const path       = require('path');
const fs         = require('fs');
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { healthCheck, pool } = require('../database/db');
const tonService = require('./services/tonService');
const { startMonitoring } = require('./services/monitorService');
const { authMiddleware } = require('./middleware/auth');

// ============================================================
// SafeDeal Backend — Express API Server
// ============================================================

const app  = express();
const PORT = process.env.PORT || 3000;

// Railway / Render / любой reverse-proxy ставит X-Forwarded-For
// Без trust proxy express-rate-limit бросает ValidationError
app.set('trust proxy', 1);

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

// Admin panel — после express.json() чтобы req.body работал
app.use('/admark', require('./routes/admin'));

// Rate limiting: 100 запросов за 15 минут с одного IP
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Слишком много запросов, попробуйте позже' },
}));

// ---------- Статика (превью + баннеры — публичные) ----------
app.use('/previews', express.static(
  require('path').join(__dirname, '../storage/previews'),
  { maxAge: '1h' }
));
app.use('/banners', express.static(
  require('path').join(__dirname, '../storage/banners'),
  { maxAge: '7d' }
));
app.use('/avatars', express.static(
  require('path').join(__dirname, '../storage/avatars'),
  { maxAge: '7d' }
));
app.use('/slides', express.static(
  require('path').join(__dirname, '../storage/slides'),
  { maxAge: '7d' }
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

// Публичный: просмотр сделки по invite-ссылке (не требует авторизации)
app.use('/api/rooms', require('./routes/rooms'));

// ---------- Защищённые маршруты (требуют Telegram initData) ----------
app.use('/api/', authMiddleware);

app.use('/api/contracts',  require('./routes/contracts'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/disputes',   require('./routes/disputes'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/jobs',       require('./routes/jobs'));
app.use('/api/livefeed',   require('./routes/livefeed'));
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
      || req.path.startsWith('/admark')
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

// ---------- Автомиграции ----------
async function runMigrations() {
  const fs   = require('fs');
  const path = require('path');
  const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(256) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const { rows: applied } = await client.query('SELECT filename FROM _migrations ORDER BY filename');
    const appliedSet = new Set(applied.map(r => r.filename));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migrate] ✅ ${file}`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrate] ❌ ${file}:`, err.message);
        throw err;
      }
    }
    if (count > 0) console.log(`[Migrate] Applied ${count} migration(s)`);
    else console.log('[Migrate] All migrations up to date');
  } finally {
    client.release();
  }
}

// ---------- Запуск ----------
async function start() {
  // Проверяем БД
  const dbOk = await healthCheck();
  if (!dbOk) {
    console.error('[Server] ОШИБКА: Не удалось подключиться к PostgreSQL');
    process.exit(1);
  }
  console.log('[Server] ✅ PostgreSQL подключён');

  // Автоматически применяем новые миграции
  await runMigrations();

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
