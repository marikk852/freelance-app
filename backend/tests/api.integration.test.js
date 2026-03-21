/**
 * SafeDeal — Интеграционные тесты API
 * Агент 8: проверяем что endpoints работают корректно
 */

const request = require('supertest');
const crypto  = require('crypto');

// Мокаем зависимости до импорта app
jest.mock('../../database/db', () => ({
  query      : jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn(async (cb) => cb({ query: jest.fn().mockResolvedValue({ rows: [] }) })),
  healthCheck: jest.fn().mockResolvedValue(true),
  pool       : { on: jest.fn(), end: jest.fn() },
}));
jest.mock('../services/tonService', () => ({
  init                 : jest.fn(),
  getArbitratorAddress : jest.fn().mockReturnValue('UQMock'),
  getTonUsdPrice       : jest.fn().mockResolvedValue(3.0),
  sendArbitratorMessage: jest.fn().mockResolvedValue('tx_hash_mock'),
  runGetMethod         : jest.fn(),
  getTransactions      : jest.fn().mockResolvedValue([]),
}));
jest.mock('../services/monitorService', () => ({ startMonitoring: jest.fn() }));

// Генерируем валидный initData для тестов
const BOT_TOKEN = 'test:TOKEN';
process.env.BOT_TOKEN   = BOT_TOKEN;
process.env.WEBAPP_URL  = 'https://example.com';
process.env.DATABASE_URL = 'postgresql://test';

function makeInitData(userId = 12345) {
  const user     = JSON.stringify({ id: userId, first_name: 'Test' });
  const authDate = Math.floor(Date.now() / 1000).toString();
  const params   = new URLSearchParams();
  params.set('auth_date', authDate);
  params.set('user', user);
  const dataStr  = Array.from(params.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const key      = crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const hash     = crypto.createHmac('sha256', key).update(dataStr).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

let app;
beforeAll(() => { app = require('../server'); });

// ============================================================
describe('GET /health', () => {
  it('возвращает статус ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});

// ============================================================
describe('🔒 Авторизация API — требует Telegram initData', () => {
  it('GET /api/users/me без заголовка → 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/users/me с поддельным initData → 401', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('X-Telegram-Init-Data', 'hash=fakehash&auth_date=0&user=%7B%7D');
    expect(res.status).toBe(401);
  });

  it('GET /api/users/me с валидным initData → не 401', async () => {
    const { query } = require('../../database/db');
    query.mockResolvedValueOnce({ rows: [{ id: 1, telegram_id: 12345, level: 1, xp: 0, streak_days: 0, rating: 0, deals_completed: 0, safe_coins: 0 }] });

    const res = await request(app)
      .get('/api/users/me')
      .set('X-Telegram-Init-Data', makeInitData(12345));
    expect(res.status).not.toBe(401);
  });
});

// ============================================================
describe('📋 POST /api/contracts — валидация', () => {
  const validData = {
    title      : 'Разработка сайта',
    description: 'Нужен лендинг с анимацией',
    amount_usd : 100,
    currency   : 'USDT',
    deadline   : new Date(Date.now() + 86400000 * 7).toISOString(),
    criteria   : [
      { text: 'Критерий 1', required: true },
      { text: 'Критерий 2', required: true },
      { text: 'Критерий 3', required: true },
    ],
  };

  it('должен ОТКЛОНИТЬ без заголовка авторизации → 401', async () => {
    const res = await request(app).post('/api/contracts').send(validData);
    expect(res.status).toBe(401);
  });

  it('должен ОТКЛОНИТЬ сумму > $500 → 400', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('X-Telegram-Init-Data', makeInitData())
      .send({ ...validData, amount_usd: 501 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/500/);
  });

  it('должен ОТКЛОНИТЬ менее 3 критериев → 400', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('X-Telegram-Init-Data', makeInitData())
      .send({ ...validData, criteria: [{ text: 'Только один', required: true }] });
    expect(res.status).toBe(400);
  });

  it('должен ОТКЛОНИТЬ прошедший дедлайн → 400', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('X-Telegram-Init-Data', makeInitData())
      .send({ ...validData, deadline: new Date(Date.now() - 86400000).toISOString() });
    expect(res.status).toBe(400);
  });

  it('должен ОТКЛОНИТЬ неверную валюту → 400', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('X-Telegram-Init-Data', makeInitData())
      .send({ ...validData, currency: 'BTC' }); // BTC не поддерживается в MVP
    expect(res.status).toBe(400);
  });
});

// ============================================================
describe('💼 GET /api/jobs — публичный список заказов', () => {
  it('требует авторизацию', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(401);
  });
});

// ============================================================
describe('📊 Rate Limiting', () => {
  it('API имеет rate-limiting middleware', () => {
    const serverSrc = require('fs').readFileSync(
      require('path').join(__dirname, '../server.js'), 'utf8'
    );
    expect(serverSrc).toContain('rateLimit');
    expect(serverSrc).toContain('windowMs');
  });
});

// ============================================================
describe('🚫 404 для неизвестных маршрутов', () => {
  it('неизвестный маршрут → 404', async () => {
    const res = await request(app).get('/api/nonexistent_endpoint_xyz');
    // 401 (нет авторизации) или 404 — в любом случае не 200
    expect([401, 404]).toContain(res.status);
  });
});
