const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const { TronWeb } = require('tronweb');
const { query, transaction } = require('../../database/db');
const { Escrow } = require('../../database/models');
const notificationService = require('./notificationService');

// ============================================================
// EVM Escrow Service — управление Solidity-эскроу USDT на Ethereum и Tron.
//
// Зеркалит публичный API TON-escrowService (deploy/monitor/release/refund/split),
// но работает с контрактом SafeDealEscrow.sol. Один и тот же ABI/байткод
// деплоится в обе сети: Tron (TVM) бинарно совместим с EVM.
//
// РАЗНИЦА СЕТЕЙ спрятана в адаптерах: Ethereum через ethers.js, Tron через
// tronweb (другой формат адресов base58 и подпись). Логика сделки — общая.
//
// ПРАВИЛО: release/refund/split подписывает ТОЛЬКО кошелёк арбитра платформы.
// ============================================================

const USDT_DECIMALS = 6;                     // USDT: 6 знаков в обеих сетях
const FEE_BPS = Number(process.env.PLATFORM_FEE_PERCENT || 2) * 100; // 2% → 200 б.п.

// Скомпилированный контракт (ABI + bytecode) из contracts-evm/build.
const artifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../contracts-evm/build/SafeDealEscrow.json'), 'utf8')
);
const ESCROW_ABI = artifact.abi;
const ESCROW_BYTECODE = artifact.bytecode;

// ------------------------------------------------------------
// Конфигурация сетей. Значения по умолчанию — mainnet USDT.
// RPC и приватные ключи арбитра берутся из env (см. checkEnv).
// ------------------------------------------------------------
const CHAINS = {
  ETH: {
    kind      : 'evm',
    name      : 'Ethereum',
    // chainId нужен фронту, чтобы попросить MetaMask переключить сеть
    // (1 = mainnet, 11155111 = Sepolia — на время тестнета задаётся в env)
    chainId   : Number(process.env.ETH_CHAIN_ID || 1),
    rpc       : process.env.ETH_RPC_URL,
    usdt      : process.env.ETH_USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    arbiterKey: process.env.EVM_ARBITRATOR_PRIVATE_KEY,
    explorer  : 'https://etherscan.io/tx/',
  },
  TRON: {
    kind      : 'tron',
    name      : 'Tron',
    chainId   : null,             // у Tron нет EIP-155 chainId — сеть выбирает TronLink
    rpc       : process.env.TRON_FULL_HOST || 'https://api.trongrid.io',
    usdt      : process.env.TRON_USDT_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    arbiterKey: process.env.TRON_ARBITRATOR_PRIVATE_KEY,
    explorer  : 'https://tronscan.org/#/transaction/',
  },
};

/**
 * Готова ли сеть принимать сделки. Требуется И RPC, И ключ арбитра: без ключа
 * платформа не сможет сделать release/refund, и деньги клиента застрянут
 * в контракте. Пока сеть не настроена в env — она не предлагается в UI
 * и отбивается на создании сделки.
 * @param {'ETH'|'TRON'} chain
 */
function isChainAvailable(chain) {
  const cfg = CHAINS[chain];
  return !!(cfg && cfg.rpc && cfg.arbiterKey);
}

/** Сети, в которых сейчас можно создать сделку. TON доступен всегда. */
function availableChains() {
  return ['TON', ...Object.keys(CHAINS).filter(isChainAvailable)];
}

function chainConfig(chain) {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`[EVM] Неизвестная сеть: ${chain}`);
  if (!cfg.rpc)        throw new Error(`[EVM] Не задан RPC для ${chain}`);
  if (!cfg.arbiterKey) throw new Error(`[EVM] Не задан ключ арбитра для ${chain}`);
  return cfg;
}

// USD → минимальные единицы токена (BigInt, 6 знаков)
function toUnits(amountUsd) {
  return ethers.parseUnits(String(amountUsd), USDT_DECIMALS);
}

// ============================================================
// Адаптеры сети. Оба реализуют один интерфейс:
//   deploy(args)              → { address, txHash }
//   readStatus(address)       → number  (0..3)
//   sendArbiter(addr, m, a[]) → txHash
// ============================================================

function ethAdapter(cfg) {
  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const wallet   = new ethers.Wallet(cfg.arbiterKey, provider);

  return {
    async deploy(args) {
      const factory = new ethers.ContractFactory(ESCROW_ABI, ESCROW_BYTECODE, wallet);
      const contract = await factory.deploy(...args);
      const tx = contract.deploymentTransaction();
      await contract.waitForDeployment();
      return { address: await contract.getAddress(), txHash: tx.hash };
    },
    async readStatus(address) {
      const c = new ethers.Contract(address, ESCROW_ABI, provider);
      return Number(await c.status());
    },
    async sendArbiter(address, method, args = []) {
      const c = new ethers.Contract(address, ESCROW_ABI, wallet);
      const tx = await c[method](...args);
      await tx.wait();
      return tx.hash;
    },
  };
}

function tronAdapter(cfg) {
  const tronWeb = new TronWeb({ fullHost: cfg.rpc, privateKey: cfg.arbiterKey });

  return {
    async deploy(args) {
      const tx = await tronWeb.contract().new({
        abi: ESCROW_ABI,
        bytecode: ESCROW_BYTECODE.replace(/^0x/, ''),
        feeLimit: 1_000_000_000,   // 1000 TRX потолок на деплой
        parameters: args,
      });
      return { address: tronWeb.address.fromHex(tx.address), txHash: tx.deployed?.txID || tx.txID };
    },
    async readStatus(address) {
      const c = await tronWeb.contract(ESCROW_ABI, address);
      const s = await c.status().call();
      return Number(s);
    },
    async sendArbiter(address, method, args = []) {
      const c = await tronWeb.contract(ESCROW_ABI, address);
      return c[method](...args).send();
    },
  };
}

function adapter(chain) {
  const cfg = chainConfig(chain);
  return cfg.kind === 'tron' ? tronAdapter(cfg) : ethAdapter(cfg);
}

// 0=Waiting,1=Frozen,2=Released,3=Refunded → статусы БД
const STATUS_MAP = { 0: 'waiting', 1: 'frozen', 2: 'released', 3: 'refunded' };

// ============================================================
// Деплой эскроу в выбранной сети.
// Конструктор SafeDealEscrow: (token, client, freelancer, arbitrator, amount, feeBps, deadline)
// ============================================================
async function deployEvmContract({
  contractId, chain, clientAddress, freelancerAddress, amountUsd, deadlineDate,
}) {
  if (amountUsd > 10000) throw new Error(`Сумма $${amountUsd} превышает потолок $10000`);
  const cfg = chainConfig(chain);
  const a   = adapter(chain);

  const arbiterAddress = chain === 'TRON'
    ? new TronWeb({ fullHost: cfg.rpc, privateKey: cfg.arbiterKey }).defaultAddress.base58
    : new ethers.Wallet(cfg.arbiterKey).address;

  const amountUnits = toUnits(amountUsd);
  const deadline    = Math.floor(deadlineDate.getTime() / 1000);

  const { address, txHash } = await a.deploy([
    cfg.usdt, clientAddress, freelancerAddress, arbiterAddress,
    amountUnits, FEE_BPS, deadline,
  ]);

  await transaction(async (client) => {
    await client.query(
      `UPDATE contracts SET ton_contract_address = $2, chain = $3,
         crypto_amount = $4, status = 'awaiting_payment', updated_at = NOW()
       WHERE id = $1`,
      [contractId, address, chain, amountUsd]
    );
    await client.query(
      `INSERT INTO escrow (contract_id, currency, chain, amount, amount_usd, platform_fee, ton_contract_address)
       VALUES ($1, 'USDT', $2, $3, $3, $4, $5)`,
      [contractId, chain, amountUsd, amountUsd * FEE_BPS / 10000, address]
    );
    await client.query(
      `INSERT INTO audit_log (contract_id, action, details, tx_hash)
       VALUES ($1, 'deploy_contract', $2, $3)`,
      [contractId, JSON.stringify({ address, chain, amountUsd, feeBps: FEE_BPS }), txHash]
    );
  });

  console.log(`[EVM] Эскроу ${chain} задеплоен: ${address} (сделка ${contractId})`);
  return { contractAddress: address, chain, explorerTx: cfg.explorer + txHash };
}

// ============================================================
// Параметры оплаты для кошелька клиента (MetaMask / TronLink).
//
// Депозит в EVM — ДВА шага: approve(escrow, amount) в контракте USDT,
// затем deposit() в эскроу. Calldata собираем здесь, чтобы фронт не тянул
// ethers в бандл Mini App и не знал деталей ABI.
//
// ⚠️ Про USDT-квирк «approve только с нуля»: настоящий Tether требует, чтобы
// текущий allowance был 0 перед новым ненулевым approve. Нам это не грозит —
// эскроу деплоится персонально под сделку, у него allowance всегда 0.
// ============================================================
const ERC20_APPROVE_IFACE = new ethers.Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
]);
const ESCROW_DEPOSIT_IFACE = new ethers.Interface(['function deposit()']);

function buildEvmPaymentParams({ chain, escrowAddress, amountUsd, clientAddress }) {
  const cfg = CHAINS[chain];
  if (!cfg) throw new Error(`[EVM] Неизвестная сеть: ${chain}`);

  const amountUnits = toUnits(amountUsd);

  // Calldata собираем ТОЛЬКО для EVM: адреса Tron — base58, ethers их не кодирует,
  // да и TronLink подписывает через собственный contract API, а не сырой data.
  const calldata = cfg.kind === 'evm'
    ? {
        approveData  : ERC20_APPROVE_IFACE.encodeFunctionData('approve', [escrowAddress, amountUnits]),
        depositData  : ESCROW_DEPOSIT_IFACE.encodeFunctionData('deposit', []),
        // eth_call для проверок ДО подписи: хватает ли USDT и не одобрено ли уже
        // (повторный approve на Ethereum — выброшенные на газ деньги)
        balanceOfData: ERC20_APPROVE_IFACE.encodeFunctionData('balanceOf', [clientAddress]),
        allowanceData: ERC20_APPROVE_IFACE.encodeFunctionData('allowance', [clientAddress, escrowAddress]),
      }
    : { approveData: null, depositData: null, balanceOfData: null, allowanceData: null };

  return {
    chain,
    kind         : cfg.kind,                 // 'evm' → MetaMask, 'tron' → TronLink
    chainName    : cfg.name,
    chainId      : cfg.chainId,
    chainIdHex   : cfg.chainId ? '0x' + cfg.chainId.toString(16) : null,
    escrowAddress,
    tokenAddress : cfg.usdt,
    clientAddress,
    decimals     : USDT_DECIMALS,
    amountUnits  : amountUnits.toString(),
    amountUsd    : Number(amountUsd),
    ...calldata,
    explorerTx   : cfg.explorer,
  };
}

// ============================================================
// Мониторинг: читаем on-chain статус, при заморозке двигаем сделку.
// (USDT на EVM отбивает недоплату в самом контракте — Underfunded,
//  поэтому Frozen гарантирует полную сумму, доп. сверки не нужно.)
// ============================================================
async function monitorEvmContract(contractId) {
  const escrowRow = await Escrow.findByContractId(contractId);
  if (!escrowRow) throw new Error(`[EVM] Эскроу не найден: ${contractId}`);
  if (['released', 'refunded'].includes(escrowRow.status)) return escrowRow.status;

  let onChain;
  try {
    onChain = await adapter(escrowRow.chain).readStatus(escrowRow.ton_contract_address);
  } catch {
    return 'waiting'; // контракт ещё не активен / RPC недоступен
  }
  const newStatus = STATUS_MAP[onChain] || 'waiting';

  if (newStatus === 'frozen' && escrowRow.status === 'waiting_payment') {
    await transaction(async (client) => {
      await client.query(
        `UPDATE escrow SET status = 'frozen', frozen_at = NOW() WHERE contract_id = $1`,
        [contractId]
      );
      await client.query(
        `UPDATE contracts SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
        [contractId]
      );
      await client.query(
        `INSERT INTO audit_log (contract_id, action, details)
         VALUES ($1, 'deposit', $2)`,
        [contractId, JSON.stringify({ status: 'frozen', chain: escrowRow.chain })]
      );
    });
    console.log(`[EVM] Депозит получен, сделка заморожена: ${contractId} (${escrowRow.chain})`);
  }
  return newStatus;
}

// Общий помощник для release/refund/split
async function sendArbiterAction(contractId, dbStatus, method, methodArgs, auditAction) {
  const escrowRow = await Escrow.findByContractId(contractId);
  if (!escrowRow) throw new Error(`[EVM] Эскроу не найден: ${contractId}`);
  if (escrowRow.status !== 'frozen') {
    throw new Error(`[EVM] Неверный статус для ${method}: ${escrowRow.status}`);
  }

  const txHash = await adapter(escrowRow.chain).sendArbiter(
    escrowRow.ton_contract_address, method, methodArgs
  );

  await transaction(async (client) => {
    await client.query(
      `UPDATE escrow SET status = $2, tx_hash_out = $3,
         ${dbStatus === 'released' ? 'released_at' : 'refunded_at'} = NOW()
       WHERE contract_id = $1`,
      [contractId, dbStatus, txHash]
    );
    await client.query(
      `UPDATE contracts SET status = $2, updated_at = NOW() WHERE id = $1`,
      [contractId, dbStatus === 'released' ? 'completed' : 'refunded']
    );
    await client.query(
      `INSERT INTO audit_log (contract_id, action, details, tx_hash)
       VALUES ($1, $2, $3, $4)`,
      [contractId, auditAction, JSON.stringify({ chain: escrowRow.chain }), txHash]
    );
  });
  return txHash;
}

// RELEASE — только после approved delivery (проверка вызывающим слоем, как в TON-сервисе)
async function releaseEvmEscrow(contractId, approvedBy) {
  const { rows } = await query(
    `SELECT id FROM deliveries WHERE contract_id = $1 AND status = 'approved' LIMIT 1`,
    [contractId]
  );
  if (rows.length === 0) throw new Error('[EVM] ОТКАЗАНО: delivery не одобрен');
  return sendArbiterAction(contractId, 'released', 'release', [], 'release');
}

async function refundEvmEscrow(contractId, requestedBy) {
  return sendArbiterAction(contractId, 'refunded', 'refund', [], 'refund');
}

// freelancerPercent (0..100) → базисные пункты для split(uint16)
async function splitEvmEscrow(contractId, freelancerPercent, resolvedBy) {
  if (freelancerPercent < 0 || freelancerPercent > 100) {
    throw new Error(`[EVM] Неверный процент split: ${freelancerPercent}`);
  }
  return sendArbiterAction(contractId, 'refunded', 'split', [freelancerPercent * 100], 'split');
}

module.exports = {
  deployEvmContract,
  buildEvmPaymentParams,
  isChainAvailable,
  availableChains,
  monitorEvmContract,
  releaseEvmEscrow,
  refundEvmEscrow,
  splitEvmEscrow,
  // экспорт для тестов
  _internal: { toUnits, ESCROW_ABI, CHAINS, FEE_BPS },
};
