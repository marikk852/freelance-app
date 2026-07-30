const { ethers } = require('ethers');
const chainAddress = require('../services/chainAddress');
const evm = require('../services/evmEscrowService');

// ============================================================
// Мультичейн-кошельки и параметры оплаты (Фаза 4) — без сети.
//
// Здесь ловятся ошибки, которые стоят денег: адрес не той сети, принятый
// как валидный (выплата уйдёт в пустоту), и битая calldata approve/deposit
// (клиент подпишет не то, что думает).
// ============================================================

describe('chainAddress — валидация адресов по сетям', () => {
  const TON  = 'UQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
  const ETH  = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

  test('валидные адреса принимаются своей сетью', () => {
    expect(chainAddress.isValidAddress('TON',  TON)).toBe(true);
    expect(chainAddress.isValidAddress('ETH',  ETH)).toBe(true);
    expect(chainAddress.isValidAddress('TRON', TRON)).toBe(true);
  });

  test('адрес чужой сети отвергается', () => {
    expect(chainAddress.isValidAddress('ETH',  TON)).toBe(false);
    expect(chainAddress.isValidAddress('ETH',  TRON)).toBe(false);
    expect(chainAddress.isValidAddress('TRON', ETH)).toBe(false);
    expect(chainAddress.isValidAddress('TON',  ETH)).toBe(false);
  });

  test('битая контрольная сумма отвергается', () => {
    // ETH: EIP-55 checksum поломан последним символом
    expect(chainAddress.isValidAddress('ETH', '0xdAC17F958D2ee523a2206206994597C13D831ec8')).toBe(false);
    // Tron: base58check не сходится
    expect(chainAddress.isValidAddress('TRON', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X')).toBe(false);
  });

  test('пустые значения и неизвестная сеть отвергаются', () => {
    expect(chainAddress.isValidAddress('ETH', '')).toBe(false);
    expect(chainAddress.isValidAddress('ETH', null)).toBe(false);
    expect(chainAddress.isValidAddress('BTC', ETH)).toBe(false);
  });

  test('ETH нормализуется к EIP-55, остальные сети — как есть', () => {
    expect(chainAddress.normalizeAddress('ETH', ETH.toLowerCase())).toBe(ETH);
    expect(chainAddress.normalizeAddress('TRON', TRON)).toBe(TRON);
    expect(chainAddress.normalizeAddress('TON', TON)).toBe(TON);
  });

  test('каждая поддерживаемая сеть имеет свою колонку в users', () => {
    for (const chain of chainAddress.SUPPORTED_CHAINS) {
      expect(chainAddress.WALLET_COLUMN[chain]).toMatch(/^[a-z_]+_wallet_address$/);
    }
    // Колонки различны — иначе адреса сетей затирали бы друг друга
    const columns = Object.values(chainAddress.WALLET_COLUMN);
    expect(new Set(columns).size).toBe(columns.length);
  });
});

describe('buildEvmPaymentParams — параметры оплаты для кошелька', () => {
  const escrow = '0x1111111111111111111111111111111111111111';
  const client = '0x2222222222222222222222222222222222222222';

  const erc20 = new ethers.Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
  ]);

  test('сумма переводится в единицы USDT (6 знаков)', () => {
    const p = evm.buildEvmPaymentParams({ chain: 'ETH', escrowAddress: escrow, amountUsd: 100, clientAddress: client });
    expect(p.amountUnits).toBe('100000000');
    expect(p.decimals).toBe(6);
  });

  test('approve выдан ровно на эскроу и ровно на сумму сделки', () => {
    const p = evm.buildEvmPaymentParams({ chain: 'ETH', escrowAddress: escrow, amountUsd: 250.5, clientAddress: client });
    const decoded = erc20.decodeFunctionData('approve', p.approveData);
    expect(decoded[0]).toBe(escrow);                       // ни адресом больше
    expect(decoded[1].toString()).toBe('250500000');       // ни центом больше
  });

  test('deposit() — без аргументов, канонический селектор', () => {
    const p = evm.buildEvmPaymentParams({ chain: 'ETH', escrowAddress: escrow, amountUsd: 10, clientAddress: client });
    expect(p.depositData).toBe('0xd0e30db0');
  });

  test('balanceOf/allowance спрашивают про кошелёк клиента', () => {
    const p = evm.buildEvmPaymentParams({ chain: 'ETH', escrowAddress: escrow, amountUsd: 10, clientAddress: client });
    expect(erc20.decodeFunctionData('balanceOf', p.balanceOfData)[0]).toBe(client);
    const allowance = erc20.decodeFunctionData('allowance', p.allowanceData);
    expect(allowance[0]).toBe(client);
    expect(allowance[1]).toBe(escrow);
  });

  const TRON_ADDR = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

  test('ETH отдаёт chainId для переключения сети, Tron — нет', () => {
    const eth  = evm.buildEvmPaymentParams({ chain: 'ETH',  escrowAddress: escrow, amountUsd: 10, clientAddress: client });
    const tron = evm.buildEvmPaymentParams({ chain: 'TRON', escrowAddress: TRON_ADDR, amountUsd: 10, clientAddress: TRON_ADDR });

    expect(eth.kind).toBe('evm');
    expect(eth.chainIdHex).toBe('0x' + eth.chainId.toString(16));
    expect(tron.kind).toBe('tron');
    expect(tron.chainIdHex).toBeNull();
  });

  // Регрессия: base58-адреса Tron ethers закодировать не может — сборка calldata
  // для Tron роняла эндпоинт 500 на КАЖДОЙ Tron-сделке. TronLink подписывает
  // через свой contract API, поэтому calldata ему и не нужна.
  test('Tron не пытается кодировать calldata и не падает на base58', () => {
    const tron = evm.buildEvmPaymentParams({ chain: 'TRON', escrowAddress: TRON_ADDR, amountUsd: 10, clientAddress: TRON_ADDR });
    expect(tron.approveData).toBeNull();
    expect(tron.depositData).toBeNull();
    expect(tron.balanceOfData).toBeNull();
    expect(tron.allowanceData).toBeNull();
    // Сумма и адреса при этом отдаются — по ним TronLink и строит транзакции
    expect(tron.amountUnits).toBe('10000000');
    expect(tron.escrowAddress).toBe(TRON_ADDR);
  });

  test('токен берётся из конфига сети, а не из запроса', () => {
    const eth  = evm.buildEvmPaymentParams({ chain: 'ETH',  escrowAddress: escrow, amountUsd: 10, clientAddress: client });
    const tron = evm.buildEvmPaymentParams({ chain: 'TRON', escrowAddress: TRON_ADDR, amountUsd: 10, clientAddress: TRON_ADDR });
    expect(eth.tokenAddress).toBe(evm._internal.CHAINS.ETH.usdt);
    expect(tron.tokenAddress).toBe(evm._internal.CHAINS.TRON.usdt);
    expect(eth.tokenAddress).not.toBe(tron.tokenAddress);
  });

  test('неизвестная сеть отбивается', () => {
    expect(() => evm.buildEvmPaymentParams({ chain: 'BTC', escrowAddress: escrow, amountUsd: 10, clientAddress: client }))
      .toThrow(/Неизвестная сеть/);
  });
});

describe('доступность сетей — гейт до настройки ключей', () => {
  const { CHAINS } = evm._internal;

  // Сеть без ключа арбитра опасна: платформа не сможет сделать release/refund,
  // и депозит клиента застрянет в контракте. Такую сеть нельзя предлагать в UI.
  test('сеть без RPC или без ключа арбитра недоступна', () => {
    const saved = { rpc: CHAINS.ETH.rpc, key: CHAINS.ETH.arbiterKey };
    try {
      CHAINS.ETH.rpc = '';       CHAINS.ETH.arbiterKey = '0xkey';
      expect(evm.isChainAvailable('ETH')).toBe(false);

      CHAINS.ETH.rpc = 'https://rpc'; CHAINS.ETH.arbiterKey = '';
      expect(evm.isChainAvailable('ETH')).toBe(false);

      CHAINS.ETH.rpc = 'https://rpc'; CHAINS.ETH.arbiterKey = '0xkey';
      expect(evm.isChainAvailable('ETH')).toBe(true);
    } finally {
      CHAINS.ETH.rpc = saved.rpc; CHAINS.ETH.arbiterKey = saved.key;
    }
  });

  test('TON доступен всегда и идёт первым', () => {
    expect(evm.availableChains()[0]).toBe('TON');
  });

  test('ненастроенная сеть не попадает в список', () => {
    const saved = CHAINS.TRON.arbiterKey;
    try {
      CHAINS.TRON.arbiterKey = '';
      expect(evm.availableChains()).not.toContain('TRON');
    } finally {
      CHAINS.TRON.arbiterKey = saved;
    }
  });

  test('неизвестная сеть недоступна', () => {
    expect(evm.isChainAvailable('BTC')).toBe(false);
  });
});
