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

// Op-коды (должны совпадать с escrow.fc)
const OP = {
  DEPOSIT : 1,
  RELEASE : 2,
  REFUND  : 3,
  SPLIT   : 4,
};

// Газ для транзакций арбитра
const ARBITRATOR_GAS = toNano('0.05');

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
  const maxAmount = Number(process.env.MAX_DEAL_AMOUNT_USD) || 500;
  if (amountUsd > maxAmount) {
    throw new Error(`Сумма сделки $${amountUsd} превышает лимит $${maxAmount}`);
  }

  // Вычисляем сумму в крипте
  const feePercent  = Number(process.env.PLATFORM_FEE_PERCENT) || 2;
  let   cryptoAmount;
  let   amountNano;

  if (currency === 'TON') {
    const tonPrice = await tonService.getTonUsdPrice();
    cryptoAmount   = amountUsd / tonPrice;
    amountNano     = toNano(cryptoAmount.toFixed(9));
  } else {
    // USDT — 1:1 к USD (jUSDT на TON)
    cryptoAmount = amountUsd;
    amountNano   = BigInt(Math.round(amountUsd * 1e6)); // jUSDT имеет 6 decimals
  }

  const arbitratorAddress = tonService.getArbitratorAddress();
  if (!arbitratorAddress) throw new Error('[Escrow] Арбитр-кошелёк не инициализирован');

  const deadline = Math.floor(deadlineDate.getTime() / 1000);

  // Загружаем скомпилированный код контракта
  const contractCode = await loadContractCode();

  // Строим init data ячейку
  const initData = buildInitData({
    clientAddr    : Address.parse(clientAddress),
    freelancerAddr: Address.parse(freelancerAddress),
    arbitratorAddr: Address.parse(arbitratorAddress),
    amountNano,
    feePercent,
    deadline,
  });

  // Вычисляем адрес контракта (deteministic из code + data)
  const { contractAddress } = require('@ton/core');
  const init = { code: contractCode, data: initData };
  const tonAddress = contractAddress(0, init).toString();

  // Деплоим контракт (отправляем первую транзакцию с StateInit)
  const txHash = await deployStateInit(tonAddress, contractCode, initData);

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
    ARBITRATOR_GAS,
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

  const body = beginCell().storeUint(OP.REFUND, 32).endCell();
  const txHash = await tonService.sendArbitratorMessage(
    escrowRow.ton_contract_address,
    ARBITRATOR_GAS,
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

  const body = beginCell()
    .storeUint(OP.SPLIT, 32)
    .storeUint(freelancerPercent, 8)
    .endCell();

  const txHash = await tonService.sendArbitratorMessage(
    escrowRow.ton_contract_address,
    ARBITRATOR_GAS,
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
 */
async function loadContractCode() {
  const fs   = require('fs');
  const path = require('path');
  const bocPath = path.join(__dirname, '../../contracts/build/escrow.boc');

  if (!fs.existsSync(bocPath)) {
    throw new Error(
      '[Escrow] Контракт не скомпилирован. Запусти: cd contracts && npm run build'
    );
  }

  const boc = fs.readFileSync(bocPath);
  return Cell.fromBoc(boc)[0];
}

/**
 * Построить ячейку init data для смарт-контракта.
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
 * Задеплоить контракт с StateInit.
 * @returns {string} хэш деплой-транзакции
 */
async function deployStateInit(tonAddress, code, data) {
  const { internal } = require('@ton/ton');

  const stateInit = beginCell()
    .storeBit(0)  // split_depth: none
    .storeBit(0)  // special: none
    .storeBit(1)  // code: present
    .storeRef(code)
    .storeBit(1)  // data: present
    .storeRef(data)
    .storeBit(0)  // library: none
    .endCell();

  const body = beginCell().endCell(); // пустое тело при деплое

  const txHash = await tonService.sendArbitratorMessage(
    tonAddress,
    toNano('0.05'),  // газ для деплоя
    body
  );

  return txHash;
}

module.exports = {
  deployContract,
  monitorContract,
  releaseEscrow,
  refundEscrow,
  splitEscrow,
};
