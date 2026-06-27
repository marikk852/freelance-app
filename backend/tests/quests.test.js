/**
 * SafeDeal — Тесты системы квестов
 * Проверяет: userId lookup по telegramId, авто-проверку, claim, SafeCoins
 */

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const { query } = require('../../database/db');

// Мокаем auth middleware — пропускает с telegramId=12345
jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { telegramId: 12345, username: 'testuser', firstName: 'Test' };
    next();
  },
  verifyTelegramInitData: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const questsRouter = require('../routes/quests');

const app = express();
app.use(express.json());
app.use('/api/quests', questsRouter);

// ---- Helpers ----
const DB_USER_ID = 99;

const questRow = {
  id: 1, key: 'link_wallet', title: 'Link TON Wallet',
  description: 'Connect your TON wallet', crystals: 100,
  icon: '💎', category: 'general', is_repeatable: false, is_active: true, sort_order: 1,
};

// ---- Tests ----

describe('GET /api/quests', () => {
  beforeEach(() => jest.clearAllMocks());

  it('должен вернуть список квестов для пользователя', async () => {
    // 1. lookup userId by telegramId
    query.mockResolvedValueOnce({ rows: [{ id: DB_USER_ID }] });
    // 2. SELECT quests + user_quests
    query.mockResolvedValueOnce({ rows: [{ ...questRow, completed: false, completed_at: null }] });
    // 3. autoCheckQuests: already completed check (loop — 1 quest key)
    query.mockResolvedValue({ rows: [] }); // not completed, not eligible (no wallet)

    const res = await request(app).get('/api/quests');
    expect(res.status).toBe(200);
    expect(res.body.quests).toHaveLength(1);
    expect(res.body.quests[0].key).toBe('link_wallet');
    expect(res.body.newlyCompleted).toEqual([]);
  });

  it('должен вернуть 404 если пользователь не найден в БД', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // no user
    const res = await request(app).get('/api/quests');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('должен авто-выполнить квест link_wallet если кошелёк привязан', async () => {
    // Default for all unspecified calls (remaining autoCheck keys + re-fetch)
    query.mockResolvedValue({ rows: [] });

    // Override in order of consumption:
    query
      .mockResolvedValueOnce({ rows: [{ id: DB_USER_ID }] })                          // 1. lookup
      .mockResolvedValueOnce({ rows: [{ ...questRow, completed: false, completed_at: null }] }) // 2. quest list
      .mockResolvedValueOnce({ rows: [] })                                             // 3. already completed? no
      .mockResolvedValueOnce({ rows: [{ ton_wallet_address: 'UQD...' }] })             // 4. eligibility: wallet
      .mockResolvedValueOnce({ rows: [questRow] });                                    // 5. get quest row
    // calls 6+ (INSERT, UPDATE, remaining keys, re-fetch) → default { rows: [] }

    const res = await request(app).get('/api/quests');
    expect(res.status).toBe(200);
    expect(res.body.newlyCompleted).toHaveLength(1);
    expect(res.body.newlyCompleted[0].key).toBe('link_wallet');
    expect(res.body.newlyCompleted[0].crystals).toBe(100);
  });
});

describe('POST /api/quests/:key/claim', () => {
  beforeEach(() => jest.clearAllMocks());

  it('должен выдать SafeCoins при успешном claim', async () => {
    // 1. lookup userId
    query.mockResolvedValueOnce({ rows: [{ id: DB_USER_ID }] });
    // 2. get quest
    query.mockResolvedValueOnce({ rows: [questRow] });
    // 3. check already completed — no
    query.mockResolvedValueOnce({ rows: [] });
    // 4. checkEligibility — wallet exists
    query.mockResolvedValueOnce({ rows: [{ ton_wallet_address: 'UQD...' }] });
    // 5. INSERT user_quests
    query.mockResolvedValueOnce({ rows: [] });
    // 6. UPDATE safe_crystals
    query.mockResolvedValueOnce({ rows: [] });
    // 7. SELECT safe_crystals
    query.mockResolvedValueOnce({ rows: [{ safe_crystals: 100 }] });

    const res = await request(app).post('/api/quests/link_wallet/claim');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.crystals).toBe(100);
    expect(res.body.totalCrystals).toBe(100);
  });

  it('должен вернуть 400 если квест уже выполнен', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: DB_USER_ID }] });
    query.mockResolvedValueOnce({ rows: [questRow] });
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // already completed

    const res = await request(app).post('/api/quests/link_wallet/claim');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Quest already completed');
  });

  it('должен вернуть 400 если условия квеста не выполнены', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: DB_USER_ID }] });
    query.mockResolvedValueOnce({ rows: [questRow] });
    query.mockResolvedValueOnce({ rows: [] }); // not completed yet
    query.mockResolvedValueOnce({ rows: [{ ton_wallet_address: null }] }); // no wallet

    const res = await request(app).post('/api/quests/link_wallet/claim');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Quest requirements not met');
  });

  it('должен вернуть 404 если квест не найден', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: DB_USER_ID }] });
    query.mockResolvedValueOnce({ rows: [] }); // quest not found

    const res = await request(app).post('/api/quests/unknown_quest/claim');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Quest not found');
  });

  it('должен вернуть 404 если пользователь не найден', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // no user

    const res = await request(app).post('/api/quests/link_wallet/claim');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});
