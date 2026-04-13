/**
 * SafeDeal — Тесты безопасности эскроу-логики
 * Агент 8: ищем баги в логике денег
 *
 * Запуск: cd backend && npm test
 */

const escrowService = require('../services/escrowService');
const { query }     = require('../../database/db');

// Моки внешних зависимостей
jest.mock('../services/tonService', () => ({
  init                  : jest.fn(),
  sendArbitratorMessage : jest.fn().mockResolvedValue('mock_tx_hash_abc123'),
  runGetMethod          : jest.fn().mockResolvedValue({ stack: { readNumber: () => 1 } }),
  getTransactions       : jest.fn().mockResolvedValue([{ hash: () => Buffer.from('deadbeef', 'hex') }]),
  getTonUsdPrice        : jest.fn().mockResolvedValue(3.0),
  getArbitratorAddress  : jest.fn().mockReturnValue('UQArbitratorMockAddress000000000000000000000'),
}));

jest.mock('../../database/db', () => ({
  query      : jest.fn(),
  transaction: jest.fn(async (cb) => cb({ query: jest.fn().mockResolvedValue({ rows: [] }) })),
}));

jest.mock('../../database/models', () => ({
  Escrow: {
    findByContractId: jest.fn(),
    setReleased     : jest.fn(),
    setRefunded     : jest.fn(),
  },
  Contract: { findById: jest.fn() },
  AuditLog: { log: jest.fn() },
}));

// ============================================================
// КРИТИЧЕСКОЕ ПРАВИЛО: release ТОЛЬКО при delivery_approved
// ============================================================
describe('🔒 КРИТИЧНО: release без approved delivery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('должен ОТКАЗАТЬ в release если нет approved delivery', async () => {
    // Нет строк с approved delivery
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      escrowService.releaseEscrow('contract-uuid-1', 123456)
    ).rejects.toThrow('delivery не одобрен');
  });

  it('должен ОТКАЗАТЬ в release если delivery = submitted (не approved)', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // 0 approved deliveries

    await expect(
      escrowService.releaseEscrow('contract-uuid-2', 123456)
    ).rejects.toThrow('delivery не одобрен');
  });

  it('должен РАЗРЕШИТЬ release при наличии approved delivery', async () => {
    const { Escrow } = require('../../database/models');
    // Есть approved delivery
    query.mockResolvedValueOnce({ rows: [{ id: 'delivery-uuid-1' }] });
    Escrow.findByContractId.mockResolvedValueOnce({
      status              : 'frozen',
      ton_contract_address: 'UQContractMock000000000000000000000000000000',
      amount              : 100,
      currency            : 'USDT',
      platform_fee        : 2,
    });

    const txHash = await escrowService.releaseEscrow('contract-uuid-3', 123456);
    expect(txHash).toBe('mock_tx_hash_abc123');
  });
});

// ============================================================
// Защита от двойного release
// ============================================================
describe('🚫 Двойной release (double-spend)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('должен ОТКАЗАТЬ при статусе escrow = released', async () => {
    const { Escrow } = require('../../database/models');
    query.mockResolvedValueOnce({ rows: [{ id: 'delivery-1' }] }); // approved delivery
    Escrow.findByContractId.mockResolvedValueOnce({
      status: 'released', // уже выплачено
      ton_contract_address: 'UQMock',
    });

    await expect(
      escrowService.releaseEscrow('contract-already-released', 123456)
    ).rejects.toThrow('Неверный статус для release: released');
  });

  it('должен ОТКАЗАТЬ при статусе escrow = refunded', async () => {
    const { Escrow } = require('../../database/models');
    query.mockResolvedValueOnce({ rows: [{ id: 'delivery-1' }] });
    Escrow.findByContractId.mockResolvedValueOnce({ status: 'refunded', ton_contract_address: 'UQ' });

    await expect(
      escrowService.releaseEscrow('contract-refunded', 123456)
    ).rejects.toThrow('Неверный статус для release: refunded');
  });
});

// ============================================================
// Защита от refund при неверном статусе
// ============================================================
describe('↩️ Refund — граничные случаи', () => {
  beforeEach(() => jest.clearAllMocks());

  it('должен РАЗРЕШИТЬ refund при статусе frozen', async () => {
    const { Escrow } = require('../../database/models');
    Escrow.findByContractId.mockResolvedValueOnce({
      status              : 'frozen',
      ton_contract_address: 'UQMock',
      amount              : 100,
      currency            : 'USDT',
    });

    const txHash = await escrowService.refundEscrow('contract-frozen', 123456);
    expect(txHash).toBe('mock_tx_hash_abc123');
  });

  it('должен РАЗРЕШИТЬ refund при статусе waiting_payment', async () => {
    const { Escrow } = require('../../database/models');
    Escrow.findByContractId.mockResolvedValueOnce({
      status              : 'waiting_payment',
      ton_contract_address: 'UQMock',
      amount              : 50,
      currency            : 'TON',
    });

    const txHash = await escrowService.refundEscrow('contract-waiting', 123456);
    expect(txHash).toBe('mock_tx_hash_abc123');
  });

  it('должен ОТКАЗАТЬ в refund при статусе released', async () => {
    const { Escrow } = require('../../database/models');
    Escrow.findByContractId.mockResolvedValueOnce({ status: 'released', ton_contract_address: 'UQ' });

    await expect(
      escrowService.refundEscrow('contract-released', 123456)
    ).rejects.toThrow('Неверный статус для refund: released');
  });
});

// ============================================================
// Лимит суммы $500
// ============================================================
describe('💰 Лимит суммы сделки', () => {
  const originalEnv = process.env;
  beforeAll(() => { process.env.MAX_DEAL_AMOUNT_USD = '500'; });
  afterAll(() => { process.env = originalEnv; });

  it('должен ОТКАЗАТЬ при сумме > $500', async () => {
    await expect(
      escrowService.deployContract({
        contractId       : 'c1',
        clientAddress    : 'UQClient',
        freelancerAddress: 'UQFreelancer',
        amountUsd        : 501,
        currency         : 'USDT',
        deadlineDate     : new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow('превышает лимит');
  });

  it('должен РАЗРЕШИТЬ при сумме = $500 (граница)', async () => {
    // Мокаем нужные зависимости
    jest.mock('fs', () => ({ existsSync: () => true, readFileSync: () => Buffer.from('') }));
    // Проверяем только что сумма прошла проверку (fs.existsSync упадёт дальше — это OK)
    try {
      await escrowService.deployContract({
        contractId       : 'c2',
        clientAddress    : 'UQClient',
        freelancerAddress: 'UQFreelancer',
        amountUsd        : 500,
        currency         : 'USDT',
        deadlineDate     : new Date(Date.now() + 86400000),
      });
    } catch (e) {
      // Ожидаем ошибку НЕ про лимит — значит лимит прошёл
      expect(e.message).not.toContain('превышает лимит');
    }
  });
});

// ============================================================
// Валидация процента split
// ============================================================
describe('⚖️ Split — валидация процента', () => {
  beforeEach(() => jest.clearAllMocks());

  it('должен ОТКАЗАТЬ при percent = 101', async () => {
    await expect(
      escrowService.splitEscrow('contract-1', 101, 123)
    ).rejects.toThrow('Неверный процент split: 101');
  });

  it('должен ОТКАЗАТЬ при percent = -1', async () => {
    await expect(
      escrowService.splitEscrow('contract-1', -1, 123)
    ).rejects.toThrow('Неверный процент split: -1');
  });

  it('должен РАЗРЕШИТЬ percent = 0 (полный refund через split)', async () => {
    const { Escrow } = require('../../database/models');
    Escrow.findByContractId.mockResolvedValueOnce({
      status: 'frozen', ton_contract_address: 'UQ',
      amount: 100, currency: 'USDT',
    });
    const txHash = await escrowService.splitEscrow('contract-split', 0, 123);
    expect(txHash).toBe('mock_tx_hash_abc123');
  });

  it('должен РАЗРЕШИТЬ percent = 100', async () => {
    const { Escrow } = require('../../database/models');
    Escrow.findByContractId.mockResolvedValueOnce({
      status: 'frozen', ton_contract_address: 'UQ',
      amount: 100, currency: 'USDT',
    });
    const txHash = await escrowService.splitEscrow('contract-full', 100, 123);
    expect(txHash).toBe('mock_tx_hash_abc123');
  });
});
