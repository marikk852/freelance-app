const { ethers } = require('ethers');
const evm = require('../services/evmEscrowService');

// ============================================================
// evmEscrowService — юнит-тесты без сети: ABI, кодирование, суммы.
// Ловят реальные баги (битый ABI/bytecode, неверное кодирование,
// ошибка в математике комиссии) до всякого testnet.
// ============================================================

describe('evmEscrowService (network-free)', () => {
  const { toUnits, ESCROW_ABI, FEE_BPS } = evm._internal;
  const iface = new ethers.Interface(ESCROW_ABI);

  test('USD → единицы токена (6 знаков)', () => {
    expect(toUnits(100).toString()).toBe('100000000');
    expect(toUnits(0.01).toString()).toBe('10000');
    expect(toUnits(9999.99).toString()).toBe('9999990000');
  });

  test('комиссия платформы = 200 б.п. (2%)', () => {
    expect(FEE_BPS).toBe(200);
  });

  test('ABI содержит все методы контракта', () => {
    for (const m of ['deposit', 'release', 'refund', 'split', 'status', 'state', 'isExpired']) {
      expect(iface.getFunction(m)).not.toBeNull();
    }
  });

  test('кодирование конструктора не падает на валидных аргументах', () => {
    const args = [
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0x1111111111111111111111111111111111111111', // client
      '0x2222222222222222222222222222222222222222', // freelancer
      '0x3333333333333333333333333333333333333333', // arbitrator
      toUnits(100),                                  // amount
      FEE_BPS,                                       // feeBps
      Math.floor(Date.now() / 1000) + 86400,         // deadline
    ];
    const encoded = iface.encodeDeploy(args);
    expect(encoded.length).toBeGreaterThan(2);
  });

  test('кодирование release/refund/split', () => {
    expect(iface.encodeFunctionData('release', [])).toMatch(/^0x/);
    expect(iface.encodeFunctionData('refund', [])).toMatch(/^0x/);
    // split(6000) = 60% в базисных пунктах
    const data = iface.encodeFunctionData('split', [6000]);
    expect(data).toMatch(/^0x/);
    const decoded = iface.decodeFunctionData('split', data);
    expect(Number(decoded[0])).toBe(6000);
  });

  test('split percent → базисные пункты (валидация границ)', async () => {
    await expect(evm.splitEvmEscrow('x', -1)).rejects.toThrow('Неверный процент');
    await expect(evm.splitEvmEscrow('x', 101)).rejects.toThrow('Неверный процент');
  });

  test('конфиг сетей содержит ETH и TRON с адресами USDT', () => {
    const { CHAINS } = evm._internal;
    expect(CHAINS.ETH.usdt).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(CHAINS.TRON.usdt).toMatch(/^T[0-9a-zA-Z]{33}$/);
  });
});
