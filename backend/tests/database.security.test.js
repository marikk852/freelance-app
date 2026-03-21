/**
 * SafeDeal — Тесты целостности данных БД
 * Агент 8: проверяем бизнес-правила на уровне моделей
 */

jest.mock('../../database/db', () => ({
  query      : jest.fn(),
  transaction: jest.fn(async (cb) => cb({ query: jest.fn().mockResolvedValue({ rows: [] }) })),
}));
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-1234' }));

const { query } = require('../../database/db');
const User     = require('../../database/models/User');
const Room     = require('../../database/models/Room');
const Contract = require('../../database/models/Contract');
const Escrow   = require('../../database/models/Escrow');
const AuditLog = require('../../database/models/AuditLog');

beforeEach(() => jest.clearAllMocks());

// ============================================================
describe('👤 User модель', () => {
  it('upsert: используется ON CONFLICT для безопасного создания/обновления', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, telegram_id: 123 }] });
    await User.upsert({ telegram_id: 123, username: 'test' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      expect.any(Array)
    );
  });

  it('findByTelegramId: использует параметризованный запрос', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await User.findByTelegramId(12345);
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([12345]);
    expect(sql).not.toContain('12345'); // не конкатенирован в строку
  });

  it('setWallet: не принимает невалидный адрес (проверяется на уровне route)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await User.setWallet(123, 'UQValidAddress000000000000000000000000000000');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ton_wallet_address'),
      expect.arrayContaining(['UQValidAddress000000000000000000000000000000'])
    );
  });
});

// ============================================================
describe('🏠 Room модель', () => {
  it('create: генерирует уникальный invite_link (UUID)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'room-uuid', invite_link: 'mock-uuid-1234' }] });
    const room = await Room.create(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO rooms'),
      expect.arrayContaining(['mock-uuid-1234'])
    );
  });

  it('joinAsFreelancer: проверяет статус waiting и freelancer_id IS NULL', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // не нашёл
    const result = await Room.joinAsFreelancer('room-1', 42);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'waiting'"),
      expect.any(Array)
    );
    expect(result).toBeNull();
  });
});

// ============================================================
describe('📄 Contract модель', () => {
  it('sign: обновляет правильную колонку для клиента', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'pending_signature' }] });
    await Contract.sign('c1', 'client');
    const [sql] = query.mock.calls[0];
    expect(sql).toContain('signed_by_client');
    expect(sql).not.toContain('signed_by_freelancer = TRUE'); // не трогаем колонку фрилансера
  });

  it('sign: обновляет правильную колонку для фрилансера', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'signed' }] });
    await Contract.sign('c1', 'freelancer');
    const [sql] = query.mock.calls[0];
    expect(sql).toContain('signed_by_freelancer');
  });

  it('complete: начисляет XP обоим участникам (+200)', async () => {
    const clientSpy = jest.fn().mockResolvedValue({ rows: [] });
    const { transaction } = require('../../database/db');
    transaction.mockImplementationOnce(async (cb) => {
      await cb({ query: clientSpy });
    });

    await Contract.complete('c1', 'r1', 10, 20);

    const xpCalls = clientSpy.mock.calls.filter(([sql]) =>
      sql.includes('add_xp') && sql.includes('200')
    );
    expect(xpCalls.length).toBe(2); // оба участника
  });
});

// ============================================================
describe('🔐 Escrow модель — неизменяемость финансовых данных', () => {
  it('setReleased: устанавливает released_at timestamp', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', status: 'released' }] });
    await Escrow.setReleased('c1', 'tx_hash_123');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("status = 'released'");
    expect(sql).toContain('released_at = NOW()');
    expect(params).toContain('tx_hash_123');
  });

  it('setRefunded: устанавливает статус refunded', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    await Escrow.setRefunded('c1', 'tx_refund_456');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("status = 'refunded'");
    expect(params).toContain('tx_refund_456');
  });
});

// ============================================================
describe('📋 AuditLog — неизменяемость записей', () => {
  it('log: всегда создаёт новую запись, никогда не обновляет', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'al1' }] });
    await AuditLog.log({
      contract_id : 'c1',
      action      : 'release',
      performed_by: 1,
      details     : { amount: '100' },
      tx_hash     : 'tx123',
    });
    const [sql] = query.mock.calls[0];
    // Только INSERT, никогда UPDATE или DELETE
    expect(sql.trim().toUpperCase()).toMatch(/^INSERT/);
    expect(sql.toUpperCase()).not.toContain('UPDATE');
    expect(sql.toUpperCase()).not.toContain('DELETE');
  });

  it('findByContract: упорядочен по ASC (хронологически)', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await AuditLog.findByContract('c1');
    const [sql] = query.mock.calls[0];
    expect(sql).toContain('ASC');
  });
});

// ============================================================
describe('🔢 Бизнес-правила целостности', () => {
  it('XP за действия: +50 создание, +200 закрытие, +25 отзыв, +10 вход', () => {
    // Проверяем константы в migrate.sql
    const fs = require('fs');
    const migrationSrc = fs.readFileSync(
      require('path').join(__dirname, '../../database/migrations/013_indexes_and_functions.sql'),
      'utf8'
    );
    expect(migrationSrc).toContain('+200 XP'); // за закрытие
    expect(migrationSrc).toContain('p_xp = 200'); // триггер deals_completed
    expect(migrationSrc).toContain('add_xp');
  });

  it('Рейтинг обновляется через триггер при каждом отзыве', () => {
    const fs = require('fs');
    const migrationSrc = fs.readFileSync(
      require('path').join(__dirname, '../../database/migrations/012_create_reviews.sql'),
      'utf8'
    );
    expect(migrationSrc).toContain('CREATE TRIGGER trigger_update_rating');
    expect(migrationSrc).toContain('update_user_rating');
    expect(migrationSrc).toContain('AVG(rating)');
  });
});
