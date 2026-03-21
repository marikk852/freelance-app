const { TonClient, WalletContractV4, internal, fromNano, toNano } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');
const { Address, Cell, beginCell } = require('@ton/core');

// ============================================================
// TON Service — низкоуровневое взаимодействие с блокчейном
// Агент 4: только TON API, без бизнес-логики
// ============================================================

let _client = null;
let _wallet = null;
let _keyPair = null;

/**
 * Инициализировать TON клиент и кошелёк арбитра.
 * Вызывается один раз при старте приложения.
 */
async function init() {
  _client = new TonClient({
    endpoint : process.env.TON_ENDPOINT || 'https://toncenter.com/api/v2/',
    apiKey   : process.env.TON_API_KEY,
  });

  const mnemonic = process.env.ARBITRATOR_WALLET_SEED;
  if (!mnemonic) throw new Error('[TON] ARBITRATOR_WALLET_SEED не задан в .env');

  _keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
  _wallet  = _client.open(
    WalletContractV4.create({ publicKey: _keyPair.publicKey, workchain: 0 })
  );

  const balance = await _wallet.getBalance();
  console.log(`[TON] Арбитр-кошелёк: ${_wallet.address.toString()}`);
  console.log(`[TON] Баланс арбитра: ${fromNano(balance)} TON`);
}

/**
 * Получить TON клиент (lazy init).
 */
function getClient() {
  if (!_client) throw new Error('[TON] Сервис не инициализирован. Вызови init() первым.');
  return _client;
}

/**
 * Получить текущий баланс адреса в нанотонах.
 * @param {string} address - UQ... или EQ...
 * @returns {Promise<bigint>}
 */
async function getBalance(address) {
  const client = getClient();
  return client.getBalance(Address.parse(address));
}

/**
 * Получить состояние аккаунта (active / uninitialized / frozen).
 * @param {string} address
 */
async function getAccountState(address) {
  const client = getClient();
  return client.getContractState(Address.parse(address));
}

/**
 * Отправить внутреннее сообщение на контракт от кошелька арбитра.
 * Используется для вызова release/refund/split.
 * @param {string} toAddress   - адрес контракта
 * @param {bigint} value       - сумма газа в нанотонах
 * @param {Cell}   body        - тело сообщения (op code + данные)
 * @returns {Promise<string>}  - хэш транзакции
 */
async function sendArbitratorMessage(toAddress, value, body) {
  if (!_wallet || !_keyPair) throw new Error('[TON] Кошелёк арбитра не инициализирован');

  const seqno = await _wallet.getSeqno();

  await _wallet.sendTransfer({
    secretKey  : _keyPair.secretKey,
    seqno,
    messages   : [
      internal({
        to    : Address.parse(toAddress),
        value,
        body,
        bounce: true,
      }),
    ],
  });

  // Ждём подтверждения транзакции (до 30 секунд)
  const txHash = await waitForTransaction(_wallet.address.toString(), seqno);
  return txHash;
}

/**
 * Подождать пока seqno кошелька увеличится (транзакция отправлена).
 * @param {string} walletAddress
 * @param {number} oldSeqno
 * @param {number} timeoutMs
 * @returns {Promise<string>} хэш последней транзакции
 */
async function waitForTransaction(walletAddress, oldSeqno, timeoutMs = 30000) {
  const client  = getClient();
  const start   = Date.now();
  const address = Address.parse(walletAddress);

  while (Date.now() - start < timeoutMs) {
    await sleep(2000);
    try {
      const txs = await client.getTransactions(address, { limit: 1 });
      if (txs.length > 0) {
        const newSeqno = await client.runMethod(address, 'seqno');
        if (newSeqno.stack.readNumber() > oldSeqno) {
          return txs[0].hash().toString('hex');
        }
      }
    } catch {
      // продолжаем ждать
    }
  }
  throw new Error('[TON] Таймаут ожидания транзакции');
}

/**
 * Получить транзакции адреса (для мониторинга контракта).
 * @param {string} address
 * @param {number} limit
 */
async function getTransactions(address, limit = 10) {
  const client = getClient();
  return client.getTransactions(Address.parse(address), { limit });
}

/**
 * Выполнить GET-метод контракта (читает данные без транзакции).
 * @param {string} address   - адрес контракта
 * @param {string} method    - имя get-метода
 * @param {Array}  args      - аргументы (опционально)
 */
async function runGetMethod(address, method, args = []) {
  const client = getClient();
  return client.runMethod(Address.parse(address), method, args);
}

/**
 * Вспомогательная функция паузы.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Получить текущий курс TON/USD с внешнего API.
 * Используется для подсчёта crypto_amount из amount_usd.
 * @returns {Promise<number>} цена TON в USD
 */
async function getTonUsdPrice() {
  try {
    const axios = require('axios');
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
      { timeout: 5000 }
    );
    return data['the-open-network'].usd;
  } catch {
    console.warn('[TON] Не удалось получить курс TON/USD, используем fallback 3.0');
    return 3.0; // fallback цена
  }
}

module.exports = {
  init,
  getClient,
  getBalance,
  getAccountState,
  sendArbitratorMessage,
  getTransactions,
  runGetMethod,
  getTonUsdPrice,
  sleep,
  getArbitratorAddress: () => _wallet?.address.toString(),
};
