// ============================================================
// Диспетчер escrowService: сделки на EVM-сети (ETH/TRON) должны
// делегироваться в evmEscrowService, TON — оставаться на TON-пути.
// ============================================================

// Мокаем EVM-сервис — проверяем факт делегирования
jest.mock('../services/evmEscrowService', () => ({
  deployEvmContract : jest.fn().mockResolvedValue({ contractAddress: '0xESCROW', chain: 'ETH' }),
  monitorEvmContract: jest.fn().mockResolvedValue('frozen'),
  releaseEvmEscrow  : jest.fn().mockResolvedValue('0xrelease'),
  refundEvmEscrow   : jest.fn().mockResolvedValue('0xrefund'),
  splitEvmEscrow    : jest.fn().mockResolvedValue('0xsplit'),
}));

jest.mock('../services/tonService', () => ({}));
jest.mock('../services/notificationService', () => ({ notify: jest.fn() }));

const mockQuery = jest.fn();
jest.mock('../../database/db', () => ({
  query: (...a) => mockQuery(...a),
  transaction: jest.fn(async (cb) => cb({ query: jest.fn().mockResolvedValue({ rows: [] }) })),
}));

jest.mock('../../database/models', () => ({
  Contract: {}, AuditLog: {},
  Escrow: { findByContractId: jest.fn() },
}));

const evm = require('../services/evmEscrowService');
const { Escrow } = require('../../database/models');
const escrowService = require('../services/escrowService');

const evmRow = { chain: 'ETH', status: 'frozen', ton_contract_address: '0xESCROW', amount_usd: 100 };
const tonRow = { chain: 'TON', status: 'frozen', ton_contract_address: 'UQ...', currency: 'TON' };

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [] });
});

describe('escrowService dispatch → EVM', () => {
  test('deployContract chain=ETH делегирует в evmEscrowService', async () => {
    await escrowService.deployContract({
      contractId: 'c1', clientAddress: '0xC', freelancerAddress: '0xF',
      amountUsd: 100, currency: 'USDT', deadlineDate: new Date(), chain: 'ETH',
    });
    expect(evm.deployEvmContract).toHaveBeenCalledWith(expect.objectContaining({ chain: 'ETH', contractId: 'c1' }));
  });

  test('releaseEscrow с EVM-эскроу делегирует', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'delivery-1' }] }); // approved delivery
    Escrow.findByContractId.mockResolvedValueOnce(evmRow);
    await escrowService.releaseEscrow('c1', 123);
    expect(evm.releaseEvmEscrow).toHaveBeenCalledWith('c1', 123);
  });

  test('refundEscrow с EVM-эскроу делегирует', async () => {
    Escrow.findByContractId.mockResolvedValueOnce(evmRow);
    await escrowService.refundEscrow('c1', 123);
    expect(evm.refundEvmEscrow).toHaveBeenCalledWith('c1', 123);
  });

  test('splitEscrow с EVM-эскроу делегирует (процент проброшен)', async () => {
    Escrow.findByContractId.mockResolvedValueOnce(evmRow);
    await escrowService.splitEscrow('c1', 60, 'admin');
    expect(evm.splitEvmEscrow).toHaveBeenCalledWith('c1', 60, 'admin');
  });

  test('monitorContract с EVM-эскроу делегирует', async () => {
    Escrow.findByContractId.mockResolvedValueOnce(evmRow);
    const r = await escrowService.monitorContract('c1');
    expect(evm.monitorEvmContract).toHaveBeenCalledWith('c1');
    expect(r).toBe('frozen');
  });

  test('TON-эскроу НЕ уходит в EVM (refund остаётся на TON-пути)', async () => {
    Escrow.findByContractId.mockResolvedValueOnce({ ...tonRow, status: 'released' });
    // released → TON-путь бросит "неверный статус", EVM не зовётся
    await expect(escrowService.refundEscrow('c1', 123)).rejects.toThrow();
    expect(evm.refundEvmEscrow).not.toHaveBeenCalled();
  });
});
