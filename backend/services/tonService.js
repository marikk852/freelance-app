const { TonClient, WalletContractV4, internal, fromNano, toNano } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');
const { Address, Cell, beginCell } = require('@ton/core');

// ============================================================
// TON Service — низкоуровневое взаимодействие с блокчейном
// Агент 4: только TON API, без бизнес-логики
// ============================================================

let _client  = null;
let _wallet  = null;
let _keyPair = null;

// ============================================================
// FIX #1: Очередь транзакций — предотвращает seqno race condition
// Все вызовы sendArbitratorMessage выстраиваются в очередь.
// Следующая транзакция стартует только после подтверждения предыдущей.
// ============================================================
let _pendingTx = Promise.resolve();

// ============================================================
// FIX #2: Кэш цены TON — замена жёсткого fallback $3.0
// ============================================================
const _priceCache = { price: null, updatedAt: 0 };
const PRICE_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 час

/**
 * Инициализировать TON клиент и кошелёк арбитра.
 * Вызывается один раз при старте приложения.
 */
async function init() {
  _client = new TonClient({
    endpoint : process.env.TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
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

  // Предупреждение при низком балансе уже при старте
  if (balance < toNano('1')) {
    console.warn(`[TON] ⚠️  НИЗКИЙ БАЛАНС АРБИТРА: ${fromNano(balance)} TON. Пополни до минимум 5 TON!`);
  }

  // Инициализируем кошелёк если он ещё не развёрнут (uninit)
  if (balance > 0n) {
    try {
      const seqno = await _wallet.getSeqno();
      if (seqno === 0) {
        console.log('[TON] Кошелёк арбитра не инициализирован. Отправляю init транзакцию...');
        await _wallet.sendTransfer({
          secretKey : _keyPair.secretKey,
          seqno     : 0,
          messages  : [
            internal({
              to    : _wallet.address,
              value : toNano('0.01'),
              body  : 'init',
              bounce: false,
            }),
          ],
        });
        await sleep(5000);
        console.log('[TON] ✅ Кошелёк арбитра инициализирован');
      }
    } catch (e) {
      console.warn('[TON] Не удалось инициализировать кошелёк:', e.message);
    }
  }
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
 */
async function getBalance(address) {
  const client = getClient();
  return client.getBalance(Address.parse(address));
}

/**
 * Получить баланс кошелька арбитра в нанотонах.
 * Используется MonitorService для алертов.
 */
async function getArbitratorBalance() {
  if (!_wallet) throw new Error('[TON] Кошелёк арбитра не инициализирован');
  return _wallet.getBalance();
}

/**
 * Получить состояние аккаунта (active / uninitialized / frozen).
 */
async function getAccountState(address) {
  const client = getClient();
  return client.getContractState(Address.parse(address));
}

/**
 * Отправить внутреннее сообщение на контракт от кошелька арбитра.
 *
 * FIX #1 — SEQNO RACE CONDITION:
 * Все транзакции идут последовательно через _pendingTx очередь.
 * Следующий вызов ждёт пока предыдущий не завершится (или упадёт).
 * Это гарантирует уникальность seqno для каждой транзакции.
 *
 * @param {string} toAddress   - адрес контракта
 * @param {bigint} value       - сумма газа в нанотонах
 * @param {Cell}   body        - тело сообщения (op code + данные)
 * @param {object} init        - StateInit для деплоя (опционально)
 * @returns {Promise<string>}  - хэш транзакции
 */
async function sendArbitratorMessage(toAddress, value, body, init = null) {
  // Цепляемся к очереди: ждём предыдущую транзакцию
  const txResult = _pendingTx.then(async () => {
    if (!_wallet || !_keyPair) throw new Error('[TON] Кошелёк арбитра не инициализирован');
    console.log(`[TON] sendArbitratorMessage → ${toAddress}, value=${fromNano(value)} TON, init=${!!init}`);

    // Проверяем достаточность баланса перед отправкой
    const balance = await _wallet.getBalance();
    if (balance < value + toNano('0.01')) {
      throw new Error(
        `[TON] Недостаточно баланса на кошельке арбитра: ${fromNano(balance)} TON. Нужно минимум ${fromNano(value + toNano('0.01'))} TON`
      );
    }

    const seqno = await _wallet.getSeqno();

    const msg = {
      to    : Address.parse(toAddress),
      value,
      body,
      bounce: init ? false : true,
    };
    if (init) msg.init = init;

    await _wallet.sendTransfer({
      secretKey : _keyPair.secretKey,
      seqno,
      messages  : [internal(msg)],
    });

    // FIX #3 — ждём подтверждения с retry-логикой
    const txHash = await waitForTransaction(_wallet.address.toString(), seqno);
    return txHash;
  });

  // Обновляем очередь: даже если текущий tx упал — следующий должен продолжить
  _pendingTx = txResult.catch(() => {});

  return txResult;
}

/**
 * Подождать пока seqno кошелька увеличится (транзакция принята сетью).
 *
 * FIX #3 — TIMEOUT WITHOUT RETRY:
 * - Увеличен таймаут с 30с до 60с
 * - После таймаута делаем финальную проверку seqno
 * - Если seqno увеличился (tx прошла, но мы пропустили момент) — возвращаем хэш
 * - Только если seqno НЕ изменился — бросаем ошибку (tx точно не прошла)
 *
 * @param {string} walletAddress
 * @param {number} oldSeqno
 * @param {number} timeoutMs      увеличен до 60 секунд
 */
async function waitForTransaction(walletAddress, oldSeqno, timeoutMs = 60000) {
  const client  = getClient();
  const start   = Date.now();
  const address = Address.parse(walletAddress);

  while (Date.now() - start < timeoutMs) {
    await sleep(2000);
    try {
      const txs = await client.getTransactions(address, { limit: 1 });
      if (txs.length > 0) {
        const newSeqnoResult = await client.runMethod(address, 'seqno');
        if (newSeqnoResult.stack.readNumber() > oldSeqno) {
          return txs[0].hash().toString('hex');
        }
      }
    } catch (e) {
      console.log('[TON] waitForTransaction polling error:', e.response?.data ?? e.message);
    }
  }

  // Таймаут вышел — финальная проверка:
  // TON eventual consistency — tx могла подтвердиться в последний момент
  console.warn('[TON] Основной таймаут истёк. Финальная проверка seqno...');
  try {
    const finalSeqnoResult = await client.runMethod(address, 'seqno');
    const finalSeqno = finalSeqnoResult.stack.readNumber();

    if (finalSeqno > oldSeqno) {
      // Транзакция подтверждена! Просто не успели поймать в poll-цикле
      console.log('[TON] ✅ Транзакция подтверждена (поймана при финальной проверке)');
      const txs = await client.getTransactions(address, { limit: 1 });
      return txs[0]?.hash().toString('hex') ?? `recovered_${Date.now()}`;
    }
  } catch (e) {
    console.error('[TON] Ошибка финальной проверки seqno:', e.message);
  }

  // seqno не изменился — транзакция точно не прошла
  throw new Error('[TON] Таймаут: транзакция не подтверждена за 60 секунд. Проверь баланс арбитра и состояние сети TON.');
}

/**
 * Получить транзакции адреса (для мониторинга контракта).
 */
async function getTransactions(address, limit = 10) {
  const client = getClient();
  return client.getTransactions(Address.parse(address), { limit });
}

/**
 * Выполнить GET-метод контракта (читает данные без транзакции).
 */
async function runGetMethod(address, method, args = []) {
  const client = getClient();
  return client.runMethod(Address.parse(address), method, args);
}

/**
 * Вспомогательная функция паузы.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Получить текущий курс TON/USD.
 *
 * FIX #2 — PRICE CACHE:
 * - Кэшируем последнюю успешно полученную цену в памяти
 * - При недоступности CoinGecko используем кэш (не $3.0 хардкод)
 * - Если кэш старше 1 часа — логируем предупреждение
 * - Если кэш пуст и CoinGecko недоступен — только тогда fallback $3.0
 *
 * @returns {Promise<number>} цена TON в USD
 */
async function getTonUsdPrice() {
  try {
    const axios = require('axios');
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
      { timeout: 5000 }
    );
    const price = data['the-open-network'].usd;

    // Обновляем кэш при успехе
    _priceCache.price     = price;
    _priceCache.updatedAt = Date.now();

    return price;
  } catch (err) {
    // CoinGecko недоступен — пробуем кэш
    if (_priceCache.price !== null) {
      const ageMs      = Date.now() - _priceCache.updatedAt;
      const ageMinutes = Math.round(ageMs / 60000);

      if (ageMs > PRICE_CACHE_MAX_AGE_MS) {
        console.warn(`[TON] ⚠️  Цена TON из кэша УСТАРЕЛА (${ageMinutes} мин). CoinGecko: ${err.message}`);
      } else {
        console.warn(`[TON] CoinGecko недоступен, цена из кэша: $${_priceCache.price} (${ageMinutes} мин назад)`);
      }

      return _priceCache.price;
    }

    // Кэш пуст (первый запуск без интернета) — только тогда fallback
    console.error(`[TON] 🚨 CoinGecko недоступен и кэш пуст! Используется аварийный fallback $3.0. Проверь интернет-соединение.`);
    return 3.0;
  }
}

module.exports = {
  init,
  getClient,
  getBalance,
  getArbitratorBalance,
  getAccountState,
  sendArbitratorMessage,
  getTransactions,
  runGetMethod,
  getTonUsdPrice,
  sleep,
  getArbitratorAddress: () => _wallet?.address.toString(),
};
