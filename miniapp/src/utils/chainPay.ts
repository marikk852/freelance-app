// ============================================================
// Оплата USDT-эскроу из внешних кошельков: MetaMask (Ethereum) и TronLink (Tron).
//
// Депозит — ДВА шага: approve(escrow, amount) в контракте USDT, затем deposit()
// в эскроу, который втягивает средства через transferFrom. Между шагами ждём
// подтверждения: deposit до майнинга approve упадёт с "transfer amount exceeds
// allowance".
//
// Calldata приходит с backend (см. GET /contracts/:id/evm-payment) — фронт не
// тянет ethers в бандл и не дублирует ABI.
// ============================================================

export interface EvmPaymentParams {
  chain        : 'ETH' | 'TRON';
  kind         : 'evm' | 'tron';
  chainName    : string;
  chainId      : number | null;
  chainIdHex   : string | null;
  escrowAddress: string;
  tokenAddress : string;
  clientAddress: string;
  decimals     : number;
  amountUnits  : string;
  amountUsd    : number;
  approveData  : string;
  depositData  : string;
  balanceOfData: string;
  allowanceData: string;
  explorerTx   : string;
}

// Этапы для UI: пользователь должен понимать, какую из двух подписей он ставит
export type PayStep = 'connect' | 'network' | 'checking' | 'approve' | 'approve_wait' | 'deposit' | 'deposit_wait';

export interface PayCallbacks {
  onStep?: (step: PayStep) => void;
}

// Ошибка, которую можно показать пользователю как есть
export class WalletError extends Error {}

declare global {
  interface Window {
    ethereum?: any;
    tronWeb?: any;
    tronLink?: any;
  }
}

// Пользователь нажал «отклонить» в кошельке — это не сбой, а осознанный отказ
export function isUserRejection(e: any): boolean {
  const code = e?.code ?? e?.error?.code;
  const msg  = String(e?.message || e?.error?.message || '');
  return code === 4001 || code === 'ACTION_REJECTED' ||
         /user (rejected|denied|declined)|reject/i.test(msg);
}

const hexToBigInt = (hex: string): bigint => BigInt(hex && hex !== '0x' ? hex : '0x0');

// ============================================================
// Ethereum / MetaMask
// ============================================================

export function hasMetaMask(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/** Дождаться, пока транзакция попадёт в блок (аналог tx.wait() без ethers). */
async function waitForReceipt(txHash: string, timeoutMs = 300_000): Promise<any> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const receipt = await window.ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
    if (receipt) {
      // status '0x0' — транзакция включена в блок, но исполнение провалилось
      if (receipt.status === '0x0') throw new WalletError('Transaction failed on-chain');
      return receipt;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new WalletError('Timed out waiting for the transaction. Check your wallet.');
}

/** Переключить MetaMask на нужную сеть (или попросить пользователя сделать это). */
async function ensureChain(chainIdHex: string, chainName: string) {
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current?.toLowerCase() === chainIdHex.toLowerCase()) return;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (e: any) {
    if (isUserRejection(e)) throw e;
    // 4902 — сеть не добавлена в кошелёк; добавлять RPC за пользователя не будем
    throw new WalletError(`Switch your wallet to ${chainName} and try again.`);
  }
}

export async function payWithMetaMask(p: EvmPaymentParams, cb: PayCallbacks = {}): Promise<string> {
  if (!hasMetaMask()) {
    throw new WalletError('MetaMask not found. Open this page in a browser with MetaMask, or use the TON network instead.');
  }

  cb.onStep?.('connect');
  const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const from = accounts?.[0];
  if (!from) throw new WalletError('No account selected in MetaMask.');

  // Платить обязан тот адрес, что привязан в профиле: refund вернётся именно на него
  if (from.toLowerCase() !== p.clientAddress.toLowerCase()) {
    throw new WalletError(
      `Switch MetaMask to your linked wallet ${p.clientAddress.slice(0, 6)}…${p.clientAddress.slice(-4)} — refunds go to that address.`
    );
  }

  if (p.chainIdHex) {
    cb.onStep?.('network');
    await ensureChain(p.chainIdHex, p.chainName);
  }

  // Проверки до подписи: пустой баланс — частая причина провала deposit()
  cb.onStep?.('checking');
  const need = BigInt(p.amountUnits);

  const balHex = await window.ethereum.request({
    method: 'eth_call',
    params: [{ to: p.tokenAddress, data: p.balanceOfData }, 'latest'],
  });
  if (hexToBigInt(balHex) < need) {
    throw new WalletError(`Not enough USDT on ${p.chainName}: you need $${p.amountUsd.toFixed(2)}.`);
  }

  const allowanceHex = await window.ethereum.request({
    method: 'eth_call',
    params: [{ to: p.tokenAddress, data: p.allowanceData }, 'latest'],
  });

  // Повторный approve на Ethereum — это выброшенные на газ деньги
  if (hexToBigInt(allowanceHex) < need) {
    cb.onStep?.('approve');
    const approveTx: string = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: p.tokenAddress, data: p.approveData }],
    });
    cb.onStep?.('approve_wait');
    await waitForReceipt(approveTx);
  }

  cb.onStep?.('deposit');
  const depositTx: string = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: p.escrowAddress, data: p.depositData }],
  });
  cb.onStep?.('deposit_wait');
  await waitForReceipt(depositTx);

  return depositTx;
}

// ============================================================
// Tron / TronLink
//
// TronLink инжектит собственный tronWeb — он умеет подписывать и вещать
// транзакции, поэтому здесь работаем через его contract API, а не через calldata.
// ============================================================

const TRC20_ABI = [
  {
    constant: false, name: 'approve', type: 'function', stateMutability: 'Nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    constant: true, name: 'allowance', type: 'function', stateMutability: 'View',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    constant: true, name: 'balanceOf', type: 'function', stateMutability: 'View',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
];

const ESCROW_TRON_ABI = [
  { constant: false, name: 'deposit', type: 'function', stateMutability: 'Nonpayable', inputs: [], outputs: [] },
];

const TRON_FEE_LIMIT = 100_000_000; // 100 TRX потолок — с запасом на approve+deposit

export function hasTronLink(): boolean {
  return typeof window !== 'undefined' && (!!window.tronLink || !!window.tronWeb);
}

export async function payWithTronLink(p: EvmPaymentParams, cb: PayCallbacks = {}): Promise<string> {
  if (!hasTronLink()) {
    throw new WalletError('TronLink not found. Install the TronLink extension, or use the TON network instead.');
  }

  cb.onStep?.('connect');
  if (window.tronLink?.request) {
    await window.tronLink.request({ method: 'tron_requestAccounts' });
  }
  const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
  if (!tronWeb?.defaultAddress?.base58) throw new WalletError('Unlock TronLink and try again.');

  const from = tronWeb.defaultAddress.base58;
  if (from !== p.clientAddress) {
    throw new WalletError(
      `Switch TronLink to your linked wallet ${p.clientAddress.slice(0, 6)}…${p.clientAddress.slice(-4)} — refunds go to that address.`
    );
  }

  cb.onStep?.('checking');
  const need  = BigInt(p.amountUnits);
  const token = await tronWeb.contract(TRC20_ABI, p.tokenAddress);

  const balance = BigInt((await token.balanceOf(from).call()).toString());
  if (balance < need) {
    throw new WalletError(`Not enough USDT on Tron: you need $${p.amountUsd.toFixed(2)}.`);
  }

  const allowance = BigInt((await token.allowance(from, p.escrowAddress).call()).toString());
  if (allowance < need) {
    cb.onStep?.('approve');
    await token.approve(p.escrowAddress, p.amountUnits).send({ feeLimit: TRON_FEE_LIMIT });
    // Tron подтверждает блок ~3 с; ждём, чтобы deposit не увидел старый allowance
    cb.onStep?.('approve_wait');
    await new Promise(r => setTimeout(r, 6000));
  }

  cb.onStep?.('deposit');
  const escrow = await tronWeb.contract(ESCROW_TRON_ABI, p.escrowAddress);
  const txId: string = await escrow.deposit().send({ feeLimit: TRON_FEE_LIMIT });

  cb.onStep?.('deposit_wait');
  return txId;
}

/**
 * Прочитать адрес из установленного кошелька — чтобы пользователь не вбивал
 * его руками (опечатка в адресе = деньги, ушедшие в никуда).
 */
export async function detectWalletAddress(chain: 'ETH' | 'TRON'): Promise<string> {
  if (chain === 'ETH') {
    if (!hasMetaMask()) throw new WalletError('MetaMask not found in this browser.');
    const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts?.[0]) throw new WalletError('No account selected in MetaMask.');
    return accounts[0];
  }

  if (!hasTronLink()) throw new WalletError('TronLink not found in this browser.');
  if (window.tronLink?.request) {
    await window.tronLink.request({ method: 'tron_requestAccounts' });
  }
  const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
  const addr = tronWeb?.defaultAddress?.base58;
  if (!addr) throw new WalletError('Unlock TronLink and try again.');
  return addr;
}

// Единая точка входа: сеть выбирает кошелёк
export function payWithExternalWallet(p: EvmPaymentParams, cb: PayCallbacks = {}): Promise<string> {
  return p.kind === 'tron' ? payWithTronLink(p, cb) : payWithMetaMask(p, cb);
}

// Человекочитаемые подписи этапов для кнопки оплаты
export const PAY_STEP_LABEL: Record<PayStep, string> = {
  connect     : '👛 CONNECT WALLET…',
  network     : '🔀 SWITCH NETWORK…',
  checking    : '🔍 CHECKING BALANCE…',
  approve     : '✍ APPROVE USDT (1/2)',
  approve_wait: '⏳ CONFIRMING APPROVE…',
  deposit     : '✍ CONFIRM DEPOSIT (2/2)',
  deposit_wait: '⏳ FREEZING FUNDS…',
};
