const { Address, beginCell, toNano, fromNano, Cell } = require('@ton/core');
const { TonClient } = require('@ton/ton');
const tonService = require('./tonService');
const { query, transaction } = require('../../database/db');
const { Contract, Escrow, AuditLog } = require('../../database/models');

// ============================================================
// Escrow Service — управление смарт-контрактами SafeDeal
// Агент 4: ТОЛЬКО этот сервис управляет деньгами
//
// ПРАВИЛО: деньги освобождаются ТОЛЬКО при delivery_approved
// ============================================================

// Op-коды (должны совпадать с escrow.fc / escrow_usdt.fc)
const OP = {
  DEPOSIT           : 1,
  RELEASE           : 2,
  REFUND            : 3,
  SPLIT             : 4,
  SET_JETTON_WALLET : 5,           // только escrow_usdt.fc — одноразовая установка jetton-wallet
  JETTON_TRANSFER   : 0xf8a7ea5,   // TEP-74 transfer (клиент → свой jetton-wallet → эскроу)
};

// Газ для транзакций арбитра (TON-эскроу)
const ARBITRATOR_GAS = toNano('0.05');

// ============================================================
// USD₮ (нативный jetton на TON) — отдельный контракт escrow_usdt.fc.
// Контракт сам шлёт jetton-переводы (~0.05 TON каждый), поэтому управляющим
// сообщениям нужен бо́льший газ, чем TON-эскроу. Значения согласованы с
// gas-check в контракте (my_balance >= N*0.05 + 0.02 TON).
// ============================================================
const USDT_DECIMALS_FACTOR = 1e6;   // нативный USD₮ на TON имеет 6 знаков
const USDT_MASTER_MAINNET  = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
const USDT_GAS = {
  deploy  : toNano('0.1'),   // деплой + OP_SET_JETTON_WALLET в одном сообщении
  release : toNano('0.3'),   // 2 jetton-перевода (фрилансер + комиссия)
  refund  : toNano('0.2'),   // 1 jetton-перевод
  split   : toNano('0.4'),   // до 3 jetton-переводов
};
// Депозит USD₮: клиент шлёт jetton transfer на свой jetton-wallet.
// forward_ton_amount должен быть > 0, иначе эскроу не получит transfer_notification.
const USDT_DEPOSIT_FORWARD_TON = toNano('0.15');   // → эскроу (notification + буфер баланса)
const USDT_DEPOSIT_MSG_TON     = toNano('0.3');    // общий TON: forward + газ wallet→wallet

/** Газ для управляющего сообщения с учётом валюты эскроу. */
function arbitratorGas(currency, op) {
  return currency === 'USDT' ? USDT_GAS[op] : ARBITRATOR_GAS;
}

/**
 * Задеплоить новый экземпляр эскроу смарт-контракта для сделки.
 * Вызывается после того как оба участника подписали контракт.
 *
 * @param {{
 *   contractId     : string,   // UUID контракта в БД
 *   clientAddress  : string,   // TON адрес клиента
 *   freelancerAddress: string, // TON адрес фрилансера
 *   amountUsd      : number,   // сумма в USD
 *   currency       : 'TON'|'USDT',
 *   deadlineDate   : Date,     // дата дедлайна
 * }} params
 * @returns {{ tonContractAddress: string, cryptoAmount: number }}
 */
async function deployContract({
  contractId,
  clientAddress,
  freelancerAddress,
  amountUsd,
  currency,
  deadlineDate,
}) {
  // Проверяем лимит $500
  // Платформенный потолок $10k (тарифный лимит проверяется при создании сделки)
  const maxAmount = 10000;
  if (amountUsd > maxAmount) {
    throw new Error(`Сумма сделки $${amountUsd} превышает потолок платформы $${maxAmount}`);
  }

  // Ставка комиссии — зафиксированная на сделке при создании (fallback на env/free)
  const { rows: cRows } = await query(
    `SELECT commission_percent FROM contracts WHERE id = $1`, [contractId]
  );
  const feePercent = cRows[0] && cRows[0].commission_percent != null
    ? Number(cRows[0].commission_percent)
    : (Number(process.env.PLATFORM_FEE_PERCENT) || 5);
  let   cryptoAmount;
  let   amountNano;

  if (currency === 'TON') {
    const tonPrice = await tonService.getTonUsdPrice();
    cryptoAmount   = amountUsd / tonPrice;
    amountNano     = toNano(cryptoAmount.toFixed(9));
  } else {
    // USDT — 1:1 к USD (нативный USD₮ на TON, 6 знаков)
    cryptoAmount = amountUsd;
    amountNano   = BigInt(Math.round(amountUsd * USDT_DECIMALS_FACTOR));
  }

  const deadline = Math.floor(deadlineDate.getTime() / 1000);

  // Симуляционный режим — не деплоим реальный контракт
  if (process.env.SIMULATE_PAYMENTS === 'true') {
    const fakeAddress = `EQ${'S'.repeat(46)}`;
    await transaction(async (client) => {
      await client.query(
        `UPDATE contracts
         SET ton_contract_address = $2, crypto_amount = $3,
             status = 'awaiting_payment', updated_at = NOW()
         WHERE id = $1`,
        [contractId, fakeAddress, cryptoAmount]
      );
      const platformFee = currency === 'TON'
        ? cryptoAmount * feePercent / 100
        : amountUsd * feePercent / 100;
      await client.query(
        `INSERT INTO escrow
           (contract_id, currency, amount, amount_usd, platform_fee, ton_contract_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contractId, currency, cryptoAmount, amountUsd, platformFee, fakeAddress]
      );
      await client.query(
        `INSERT INTO audit_log (contract_id, action, details, tx_hash)
         VALUES ($1, 'deploy_simulated', $2, $3)`,
        [contractId, JSON.stringify({ simulated: true, fakeAddress, currency, cryptoAmount }), 'sim_deploy']
      );
    });
    console.log(`[Escrow] 🧪 Simulated deploy. Контракт: ${contractId}, адрес: ${fakeAddress}`);
    return { tonContractAddress: fakeAddress, cryptoAmount, simulated: true };
  }

  const arbitratorAddress = tonService.getArbitratorAddress();
  if (!arbitratorAddress) throw new Error('[Escrow] Арбитр-кошелёк не инициализирован');

  const isUsdt = currency === 'USDT';

  // Загружаем скомпилированный код нужного контракта
  const contractCode = await loadContractCode(isUsdt ? 'escrow_usdt' : 'escrow');

  // Строим init data ячейку (раскладка различается: USD₮ хранит участников в ref-ячейке)
  const initData = isUsdt
    ? buildInitDataUsdt({
        clientAddr    : Address.parse(clientAddress),
        freelancerAddr: Address.parse(freelancerAddress),
        arbitratorAddr: Address.parse(arbitratorAddress),
        amountNano, feePercent, deadline,
      })
    : buildInitData({
        clientAddr    : Address.parse(clientAddress),
        freelancerAddr: Address.parse(freelancerAddress),
        arbitratorAddr: Address.parse(arbitratorAddress),
        amountNano, feePercent, deadline,
      });

  // Вычисляем адрес контракта (детерминированный из code + data)
  const { contractAddress } = require('@ton/core');
  const init = { code: contractCode, data: initData };
  const tonAddress = contractAddress(0, init).toString();

  let txHash;
  let jettonWalletAddress = null;

  if (isUsdt) {
    // Адрес jetton-wallet эскроу детерминирован: спрашиваем у мастера USD₮.
    // (адрес эскроу уже известен — он тоже детерминирован из code+data)
    jettonWalletAddress = await computeJettonWalletAddress(tonAddress);

    // Деплой + OP_SET_JETTON_WALLET в ОДНОМ сообщении от арбитра.
    // На uninit-аккаунте StateInit инициализирует контракт, затем тело
    // обрабатывает установку jetton-wallet (sender == арбитр). Атомарно,
    // без гонки «контракт ещё не активен». Путь покрыт тестом
    // escrow_usdt.spec.ts › "deploy + set jetton wallet in one message".
    const setBody = beginCell()
      .storeUint(OP.SET_JETTON_WALLET, 32)
      .storeAddress(Address.parse(jettonWalletAddress))
      .endCell();
    txHash = await tonService.sendArbitratorMessage(tonAddress, USDT_GAS.deploy, setBody, init);
    console.log(`[Escrow] USD₮ эскроу ${tonAddress}, jetton-wallet ${jettonWalletAddress}`);
  } else {
    // Деплоим TON-контракт (отправляем первую транзакцию с StateInit)
    txHash = await deployStateInit(tonAddress, contractCode, initData);
  }

  // Обновляем БД в транзакции
  await transaction(async (client) => {
    // Устанавливаем адрес контракта
    await client.query(
      `UPDATE contracts
       SET ton_contract_address = $2, crypto_amount = $3,
           status = 'awaiting_payment', updated_at = NOW()
       WHERE id = $1`,
      [contractId, tonAddress, cryptoAmount]
    );

    // Создаём запись эскроу
    const platformFee = currency === 'TON'
      ? cryptoAmount * feePercent / 100
      : amountUsd * feePercent / 100;

    await client.query(
      `INSERT INTO escrow
         (contract_id, currency, amount, amount_usd, platform_fee, ton_contract_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [contractId, currency, cryptoAmount, amountUsd, platformFee, tonAddress]
    );

    // Логируем в audit_log
    await client.query(
      `INSERT INTO audit_log (contract_id, action, details, tx_hash)
       VALUES ($1, 'deploy_contract', $2, $3)`,
      [
        contractId,
        JSON.stringify({
          tonAddress,
          currency,
          cryptoAmount: cryptoAmount.toString(),
          amountUsd,
          feePercent,
          deadline: deadlineDate.toISOString(),
          ...(jettonWalletAddress ? { jettonWalletAddress } : {}),
        }),
        txHash,
      ]
    );
  });

  console.log(`[Escrow] Контракт задеплоен: ${tonAddress}, сделка: ${contractId}`);
  return { tonContractAddress: tonAddress, cryptoAmount };
}

/**
 * Мониторить контракт — проверить пришёл ли депозит.
 * Вызывается по расписанию (node-cron) каждые 30 секунд.
 *
 * @param {string} contractId - UUID контракта
 * @returns {'waiting'|'frozen'|'released'|'refunded'} текущий статус
 */
async function monitorContract(contractId) {
  const escrowRow = await Escrow.findByContractId(contractId);
  if (!escrowRow) throw new Error(`[Escrow] Эскроу не найден для контракта ${contractId}`);

  // Уже завершён — не мониторим
  if (['released', 'refunded'].includes(escrowRow.status)) {
    return escrowRow.status;
  }

  const tonAddress = escrowRow.ton_contract_address;

  // Читаем статус из смарт-контракта
  let contractStatus;
  try {
    const result = await tonService.runGetMethod(tonAddress, 'get_status');
    contractStatus = result.stack.readNumber();
  } catch {
    // Контракт ещё не активен в блокчейне
    return 'waiting';
  }

  // 0=WAITING, 1=FROZEN, 2=RELEASED, 3=REFUNDED
  const STATUS_MAP = { 0: 'waiting', 1: 'frozen', 2: 'released', 3: 'refunded' };
  const newStatus = STATUS_MAP[contractStatus] || 'waiting';

  // Если статус изменился — обновляем БД
  if (newStatus === 'frozen' && escrowRow.status === 'waiting_payment') {
    // Получаем хэш последней транзакции (депозит)
    const txs = await tonService.getTransactions(tonAddress, 1);
    const txHash = txs[0]?.hash().toString('hex') || null;

    await transaction(async (client) => {
      await client.query(
        `UPDATE escrow SET status = 'frozen', tx_hash_in = $2, frozen_at = NOW()
         WHERE contract_id = $1`,
        [contractId, txHash]
      );
      await client.query(
        `UPDATE contracts SET status = 'in_progress', updated_at = NOW()
         WHERE id = $1`,
        [contractId]
      );
      await client.query(
        `INSERT INTO audit_log (contract_id, action, details, tx_hash)
         VALUES ($1, 'deposit', $2, $3)`,
        [contractId, JSON.stringify({ status: 'frozen' }), txHash]
      );
    });

    console.log(`[Escrow] Депозит получен, сделка заморожена: ${contractId}`);
  }

  return newStatus;
}

/**
 * Освободить средства фрилансеру.
 * ВЫЗЫВАТЬ ТОЛЬКО после delivery.status = 'approved'.
 *
 * @param {string} contractId - UUID контракта
 * @param {number} approvedBy - telegram_id клиента
 * @returns {string} хэш транзакции
 */
async function releaseEscrow(contractId, approvedBy) {
  // Двойная проверка: delivery должен быть approved
  const { rows: deliveries } = await query(
    `SELECT id FROM deliveries
     WHERE contract_id = $1 AND status = 'approved'
     LIMIT 1`,
    [contractId]
  );
  if (deliveries.length === 0) {
    throw new Error('[Escrow] ОТКАЗАНО: delivery не одобрен. release() запрещён.');
  }

  const escrowRow = await Escrow.findByContractId(contractId);
  if (!escrowRow) throw new Error(`[Escrow] Эскроу не найден: ${contractId}`);
  if (escrowRow.status !== 'frozen') {
    throw new Error(`[Escrow] Неверный статус для release: ${escrowRow.status}`);
  }

  // Симуляционный режим — пропускаем реальный блокчейн
  if (process.env.SIMULATE_PAYMENTS === 'true') {
    const txHash = `sim_release_${Date.now()}`;
    await transaction(async (client) => {
      await client.query(
        `UPDATE escrow SET status = 'released', tx_hash_out = $2, released_at = NOW()
         WHERE contract_id = $1`,
        [contractId, txHash]
      );
      await client.query(
        `UPDATE contracts SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [contractId]
      );
      await client.query(
        `INSERT INTO audit_log (contract_id, action, details, tx_hash)
         VALUES ($1, 'release_simulated', $2, $3)`,
        [contractId, JSON.stringify({ simulated: true, approvedBy }), txHash]
      );
    });
    console.log(`[Escrow] 🧪 Simulated release. Контракт: ${contractId}`);
    return txHash;
  }

  // Отправляем release() в смарт-контракт
  const body = beginCell().storeUint(OP.RELEASE, 32).endCell();
  const txHash = await tonService.sendArbitratorMessage(
    escrowRow.ton_contract_address,
    arbitratorGas(escrowRow.currency, 'release'),
    body
  );

  // Обновляем БД
  await transaction(async (client) => {
    await client.query(
      `UPDATE escrow SET status = 'released', tx_hash_out = $2, released_at = NOW()
       WHERE contract_id = $1`,
      [contractId, txHash]
    );
    await client.query(
      `UPDATE contracts SET status = 'completed', updated_at = NOW()
       WHERE id = $1`,
      [contractId]
    );

    // Логируем финансовую операцию
    await client.query(
      `INSERT INTO audit_log (contract_id, action, details, tx_hash)
       VALUES ($1, 'release', $2, $3)`,
      [
        contractId,
        JSON.stringify({
          approvedBy,
          escrowAmount : escrowRow.amount,
          currency     : escrowRow.currency,
          platformFee  : escrowRow.platform_fee,
          tonAddress   : escrowRow.ton_contract_address,
        }),
        txHash,
      ]
    );
  });

  console.log(`[Escrow] ✅ Release выполнен. Контракт: ${contractId}, TX: ${txHash}`);
  return txHash;
}

/**
 * Вернуть средства клиенту.
 * Вызывается при отмене сделки или просрочке дедлайна.
 *
 * @param {string} contractId
 * @param {number} requestedBy - telegram_id арбитра/клиента
 * @returns {string} хэш транзакции
 */
async function refundEscrow(contractId, requestedBy) {
  const escrowRow = await Escrow.findByContractId(contractId);
  if (!escrowRow) throw new Error(`[Escrow] Эскроу не найден: ${contractId}`);

  const allowedStatuses = ['waiting_payment', 'frozen'];
  if (!allowedStatuses.includes(escrowRow.status)) {
    throw new Error(`[Escrow] Неверный статус для refund: ${escrowRow.status}`);
  }

  // Симуляционный режим
  if (process.env.SIMULATE_PAYMENTS === 'true') {
    const txHash = `sim_refund_${Date.now()}`;
    await transaction(async (client) => {
      await client.query(
        `UPDATE escrow SET status = 'refunded', tx_hash_out = $2, released_at = NOW()
         WHERE contract_id = $1`,
        [contractId, txHash]
      );
      await client.query(
        `UPDATE contracts SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [contractId]
      );
      await client.query(
        `INSERT INTO audit_log (contract_id, action, performed_by, details, tx_hash)
         VALUES ($1, 'refund_simulated', $2, $3, $4)`,
        [contractId, requestedBy, JSON.stringify({ simulated: true }), txHash]
      );
    });
    console.log(`[Escrow] 🧪 Simulated refund. Контракт: ${contractId}`);
    return txHash;
  }

  const body = beginCell().storeUint(OP.REFUND, 32).endCell();
  const txHash = await tonService.sendArbitratorMessage(
    escrowRow.ton_contract_address,
    arbitratorGas(escrowRow.currency, 'refund'),
    body
  );

  await transaction(async (client) => {
    await client.query(
      `UPDATE escrow SET status = 'refunded', tx_hash_out = $2, released_at = NOW()
       WHERE contract_id = $1`,
      [contractId, txHash]
    );
    await client.query(
      `UPDATE contracts SET status = 'refunded', updated_at = NOW()
       WHERE id = $1`,
      [contractId]
    );
    await client.query(
      `INSERT INTO audit_log (contract_id, action, performed_by, details, tx_hash)
       VALUES ($1, 'refund', $2, $3, $4)`,
      [
        contractId,
        requestedBy,
        JSON.stringify({
          amount  : escrowRow.amount,
          currency: escrowRow.currency,
        }),
        txHash,
      ]
    );
  });

  console.log(`[Escrow] ↩️  Refund выполнен. Контракт: ${contractId}, TX: ${txHash}`);
  return txHash;
}

/**
 * Разделить средства при споре.
 * Арбитр задаёт процент фрилансеру (0-100).
 *
 * @param {string} contractId
 * @param {number} freelancerPercent - процент фрилансеру (0-100)
 * @param {number} resolvedBy - telegram_id арбитра
 * @returns {string} хэш транзакции
 */
async function splitEscrow(contractId, freelancerPercent, resolvedBy) {
  if (freelancerPercent < 0 || freelancerPercent > 100) {
    throw new Error(`[Escrow] Неверный процент split: ${freelancerPercent}`);
  }

  const escrowRow = await Escrow.findByContractId(contractId);
  if (!escrowRow) throw new Error(`[Escrow] Эскроу не найден: ${contractId}`);
  if (escrowRow.status !== 'frozen') {
    throw new Error(`[Escrow] Неверный статус для split: ${escrowRow.status}`);
  }

  // Симуляционный режим
  if (process.env.SIMULATE_PAYMENTS === 'true') {
    const txHash = `sim_split_${Date.now()}`;
    await transaction(async (client) => {
      await client.query(
        `UPDATE escrow SET status = 'refunded', tx_hash_out = $2, released_at = NOW()
         WHERE contract_id = $1`,
        [contractId, txHash]
      );
      await client.query(
        `UPDATE contracts SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [contractId]
      );
      await client.query(
        `INSERT INTO audit_log (contract_id, action, performed_by, details, tx_hash)
         VALUES ($1, 'split_simulated', $2, $3, $4)`,
        [contractId, resolvedBy, JSON.stringify({ simulated: true, freelancerPercent }), txHash]
      );
    });
    console.log(`[Escrow] 🧪 Simulated split. Контракт: ${contractId}`);
    return txHash;
  }

  const body = beginCell()
    .storeUint(OP.SPLIT, 32)
    .storeUint(freelancerPercent, 8)
    .endCell();

  const txHash = await tonService.sendArbitratorMessage(
    escrowRow.ton_contract_address,
    arbitratorGas(escrowRow.currency, 'split'),
    body
  );

  const clientPercent = 100 - freelancerPercent;

  await transaction(async (client) => {
    await client.query(
      `UPDATE escrow SET status = 'refunded', tx_hash_out = $2, released_at = NOW()
       WHERE contract_id = $1`,
      [contractId, txHash]
    );
    await client.query(
      `UPDATE contracts SET status = 'refunded', updated_at = NOW()
       WHERE id = $1`,
      [contractId]
    );
    await client.query(
      `INSERT INTO audit_log (contract_id, action, performed_by, details, tx_hash)
       VALUES ($1, 'split', $2, $3, $4)`,
      [
        contractId,
        resolvedBy,
        JSON.stringify({
          freelancerPercent,
          clientPercent,
          amount  : escrowRow.amount,
          currency: escrowRow.currency,
        }),
        txHash,
      ]
    );
  });

  console.log(`[Escrow] ⚖️  Split выполнен. ${freelancerPercent}% фрилансеру. TX: ${txHash}`);
  return txHash;
}

// ============================================================
// Вспомогательные функции
// ============================================================

/**
 * Загрузить скомпилированный FunC код контракта.
 * Компилируется через `cd contracts && npm run build`.
 * @param {string} name - 'escrow' (TON) или 'escrow_usdt' (USD₮ jetton)
 */
async function loadContractCode(name = 'escrow') {
  const fs   = require('fs');
  const path = require('path');
  const jsonPath = path.join(__dirname, `../../contracts/build/${name}.compiled.json`);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `[Escrow] Контракт ${name} не скомпилирован. Запусти: cd contracts && npm run build`
    );
  }

  const { hex } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  return Cell.fromBoc(Buffer.from(hex, 'hex'))[0];
}

/**
 * Построить ячейку init data для TON-контракта (escrow.fc).
 */
function buildInitData({ clientAddr, freelancerAddr, arbitratorAddr, amountNano, feePercent, deadline }) {
  return beginCell()
    .storeUint(0, 8)            // STATUS_WAITING = 0
    .storeAddress(clientAddr)
    .storeAddress(freelancerAddr)
    .storeAddress(arbitratorAddr)
    .storeCoins(amountNano)
    .storeUint(feePercent, 8)
    .storeUint(deadline, 32)
    .endCell();
}

/**
 * Построить init data для USD₮-контракта (escrow_usdt.fc).
 * ВАЖНО: раскладка ДОЛЖНА совпадать с load_data в escrow_usdt.fc и
 * EscrowUsdtContract.buildInitData — 4 адреса не влезают в одну ячейку,
 * поэтому участники вынесены в ref, а jetton_wallet = addr_none (ставится
 * отдельным OP_SET_JETTON_WALLET при деплое).
 */
function buildInitDataUsdt({ clientAddr, freelancerAddr, arbitratorAddr, amountNano, feePercent, deadline }) {
  return beginCell()
    .storeUint(0, 8)            // STATUS_WAITING = 0
    .storeCoins(amountNano)
    .storeUint(feePercent, 8)
    .storeUint(deadline, 32)
    .storeAddress(null)         // jetton_wallet = addr_none
    .storeRef(beginCell()
      .storeAddress(clientAddr)
      .storeAddress(freelancerAddr)
      .storeAddress(arbitratorAddr)
      .endCell())
    .endCell();
}

/**
 * Вычислить адрес jetton-wallet владельца через get_wallet_address мастера USD₮.
 * Детерминированно — не требует, чтобы кошелёк уже был задеплоен.
 * @param {string} ownerAddress - адрес владельца (наш эскроу-контракт)
 * @returns {Promise<string>} адрес jetton-wallet
 */
async function computeJettonWalletAddress(ownerAddress) {
  const master = process.env.USDT_MASTER_ADDRESS || USDT_MASTER_MAINNET;
  const result = await tonService.runGetMethod(master, 'get_wallet_address', [
    { type: 'slice', cell: beginCell().storeAddress(Address.parse(ownerAddress)).endCell() },
  ]);
  return result.stack.readAddress().toString();
}

/**
 * Построить параметры TonConnect-сообщения для оплаты USD₮-сделки.
 *
 * USD₮ — это jetton: клиент НЕ шлёт деньги напрямую на эскроу. Он шлёт
 * jetton transfer (op 0xf8a7ea5) на СВОЙ jetton-wallet, указав destination =
 * адрес эскроу и forward_ton_amount > 0. Тогда jetton-wallet эскроу пришлёт
 * контракту transfer_notification, и тот заморозит средства.
 *
 * Payload строится здесь (на backend с @ton/core), а не во фронте — фронт
 * только подставляет готовые значения в tonConnectUI.sendTransaction.
 *
 * @param {{ escrowAddress: string, clientAddress: string, amountUsd: number }} p
 * @returns {{ jettonWalletAddress: string, payloadBoc: string, amountTon: string }}
 *   jettonWalletAddress — куда слать сообщение (jetton-wallet клиента);
 *   payloadBoc — base64 тела jetton transfer; amountTon — TON (нанотоны, строка).
 */
async function buildUsdtPaymentParams({ escrowAddress, clientAddress, amountUsd }) {
  const jettonWalletAddress = await computeJettonWalletAddress(clientAddress);
  const jettonAmount = BigInt(Math.round(amountUsd * USDT_DECIMALS_FACTOR));

  const body = beginCell()
    .storeUint(OP.JETTON_TRANSFER, 32)
    .storeUint(0, 64)                              // query_id
    .storeCoins(jettonAmount)                      // сколько USD₮ перевести (6 знаков)
    .storeAddress(Address.parse(escrowAddress))    // destination = эскроу (новый владелец)
    .storeAddress(Address.parse(clientAddress))    // response_destination = клиент (сдача газа)
    .storeBit(false)                               // custom_payload: нет
    .storeCoins(USDT_DEPOSIT_FORWARD_TON)          // forward_ton_amount > 0 → transfer_notification
    .storeBit(false)                               // forward_payload пуст (в этом слайсе)
    .endCell();

  return {
    jettonWalletAddress,
    payloadBoc: body.toBoc().toString('base64'),
    amountTon : USDT_DEPOSIT_MSG_TON.toString(),
  };
}

/**
 * Задеплоить контракт с StateInit.
 * @returns {string} хэш деплой-транзакции
 */
async function deployStateInit(tonAddress, code, data) {
  const body     = beginCell().endCell(); // пустое тело при деплое
  const stateInit = { code, data };       // StateInit для деплоя контракта

  const txHash = await tonService.sendArbitratorMessage(
    tonAddress,
    toNano('0.05'),
    body,
    stateInit,
  );

  return txHash;
}

module.exports = {
  deployContract,
  monitorContract,
  releaseEscrow,
  refundEscrow,
  splitEscrow,
  buildUsdtPaymentParams,
};
