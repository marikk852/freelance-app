import { Address, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { EscrowUsdtContract, EscrowStatus } from '../wrappers/EscrowUsdtContract';
import { JettonMinter, JettonWallet } from '../wrappers/ReferenceJetton';

// ============================================================
// TESTNET ШАГ 2/2 — полный цикл USD₮-эскроу на живой сети.
//
// Повторяет то, что делает backend (escrowService), ТЕМИ ЖЕ сообщениями:
//   deploy + OP_SET_JETTON_WALLET одним сообщением → депозит jetton transfer
//   → ждём FROZEN → release / refund / split → проверяем балансы jetton.
//
// Подключённый кошелёк играет роли client + arbitrator + держатель USD₮.
// Фрилансер — отдельный testnet-адрес (вводится). Проверяем, что ему
// реально пришли jetton при release.
//
// Запуск:
//   cd contracts
//   TESTNET_USDT_MASTER=<адрес из шага 1> npx blueprint run testnetUsdtCycle --testnet
// ============================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: bigint) => (Number(n) / 1e6).toFixed(2);

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();
  const me = provider.sender().address;
  if (!me) throw new Error('Кошелёк не подключён');

  ui.write('🧪 TESTNET USD₮ — ШАГ 2/2: полный цикл эскроу');
  ui.write('=============================================');

  // ---- Параметры ----
  const masterStr = process.env.TESTNET_USDT_MASTER || await ui.input('Адрес тестового USD₮-мастера:');
  const master = provider.open(JettonMinter.createFromAddress(Address.parse(masterStr)));

  const freelancerStr = await ui.input('Адрес фрилансера (любой testnet-адрес):');
  const freelancer = Address.parse(freelancerStr);

  const amountUsd = Number(await ui.input('Сумма сделки в USD₮ (напр. 100):'));
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error('Некорректная сумма');
  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT) || 2;
  const jettonAmount = BigInt(Math.round(amountUsd * 1e6));

  // ---- Деплой эскроу + установка jetton-wallet одним сообщением ----
  const code = await compile('escrow_usdt');
  const escrow = provider.open(EscrowUsdtContract.createFromConfig({
    clientAddr    : me,         // клиент = я
    freelancerAddr: freelancer,
    arbitratorAddr: me,         // арбитр = я (release/refund/split от меня)
    amountUsd     : jettonAmount,
    feePercent,
    deadline      : Math.floor(Date.now() / 1000) + 7 * 86400,
  }, code));

  const escrowJwAddr = await master.getWalletAddress(escrow.address);
  ui.write(`\n📍 Эскроу:            ${escrow.address.toString()}`);
  ui.write(`📍 Jetton-wallet эскроу: ${escrowJwAddr.toString()}`);

  if (!(await provider.isContractDeployed(escrow.address))) {
    ui.write('⏳ Деплой эскроу + OP_SET_JETTON_WALLET (одно сообщение)...');
    await escrow.sendDeployAndSetWallet(provider.sender(), escrowJwAddr, toNano('0.1'));
    await provider.waitForDeploy(escrow.address);
  } else {
    ui.write('ℹ️  Эскроу уже задеплоен');
  }

  // Проверяем, что jetton_wallet установлен и статус WAITING
  await sleep(2000);
  const st0 = await escrow.getState();
  ui.write(`Статус: ${EscrowStatus[st0.status]}, jetton_wallet: ${st0.jettonWallet?.toString() ?? 'НЕ УСТАНОВЛЕН'}`);
  if (!st0.jettonWallet || !st0.jettonWallet.equals(escrowJwAddr)) {
    throw new Error('❌ jetton_wallet не установлен корректно — прерываю');
  }
  ui.write('✅ jetton_wallet установлен');

  // ---- Депозит: jetton transfer от меня (как клиента) на эскроу ----
  const myJw = provider.open(JettonWallet.createFromAddress(await master.getWalletAddress(me)));
  const myBalBefore = await myJw.getJettonBalance();
  ui.write(`\nМой баланс USD₮ до депозита: ${fmt(myBalBefore)}`);
  if (myBalBefore < jettonAmount) {
    throw new Error(`❌ Недостаточно тестовых USD₮ (нужно ${fmt(jettonAmount)}). Сначала шаг 1 (mint).`);
  }

  ui.write('⏳ Депозит (jetton transfer на эскроу, forward 0.15 TON)...');
  await myJw.sendTransfer(provider.sender(), {
    to: escrow.address, jettonAmount, responseAddr: me,
    forwardTon: toNano('0.15'), value: toNano('0.3'),
  });

  // Ждём FROZEN
  ui.write('Жду заморозки эскроу...');
  let status = st0.status;
  for (let i = 0; i < 25 && status !== EscrowStatus.FROZEN; i++) {
    await sleep(3000);
    try { status = await escrow.getStatus(); } catch { /* retry */ }
    ui.write(`  ...статус: ${EscrowStatus[status]}`);
  }
  if (status !== EscrowStatus.FROZEN) throw new Error('❌ Эскроу не заморозился — проверь explorer');
  const stFrozen = await escrow.getState();
  ui.write(`✅ FROZEN, зафиксированная сумма: ${fmt(stFrozen.amount)} USD₮`);

  // ---- Развязка: release / refund / split ----
  const action = (await ui.input('\nДействие — release / refund / split:')).trim().toLowerCase();
  const escrowJw = provider.open(JettonWallet.createFromAddress(escrowJwAddr));
  const freelancerJw = provider.open(JettonWallet.createFromAddress(await master.getWalletAddress(freelancer)));
  const arbJw = myJw; // арбитр = я

  const freelancerBefore = await freelancerJw.getJettonBalance().catch(() => 0n);
  const arbBefore = await arbJw.getJettonBalance().catch(() => 0n);

  if (action === 'release') {
    ui.write('⏳ RELEASE (арбитр)...');
    await escrow.sendRelease(provider.sender());
  } else if (action === 'refund') {
    ui.write('⏳ REFUND (арбитр)...');
    await escrow.sendRefund(provider.sender());
  } else if (action === 'split') {
    const pct = Number(await ui.input('Процент фрилансеру (0-100):'));
    ui.write(`⏳ SPLIT ${pct}% (арбитр)...`);
    await escrow.sendSplit(provider.sender(), pct);
  } else {
    ui.write('Неизвестное действие — выхожу (эскроу остаётся FROZEN).');
    return;
  }

  // Ждём терминального статуса
  ui.write('Жду расчёта...');
  for (let i = 0; i < 25; i++) {
    await sleep(3000);
    try {
      status = await escrow.getStatus();
      if (status === EscrowStatus.RELEASED || status === EscrowStatus.REFUNDED) break;
    } catch { /* retry */ }
  }
  ui.write(`Финальный статус эскроу: ${EscrowStatus[status]}`);

  // Балансы после (jetton доходят с задержкой — даём время)
  await sleep(6000);
  const escrowBal = await escrowJw.getJettonBalance().catch(() => 0n);
  const freelancerAfter = await freelancerJw.getJettonBalance().catch(() => 0n);
  const arbAfter = await arbJw.getJettonBalance().catch(() => 0n);

  ui.write('\n──────── РЕЗУЛЬТАТ (USD₮) ────────');
  ui.write(`Эскроу jetton-wallet:  ${fmt(escrowBal)}  (ожидается ~0)`);
  ui.write(`Фрилансер получил:     +${fmt(freelancerAfter - freelancerBefore)}`);
  ui.write(`Арбитр (комиссия):     +${fmt(arbAfter - arbBefore)}`);
  ui.write('──────────────────────────────────');
  ui.write('Сверь с ожиданием: release → фрилансер 98%, арбитр 2%; refund → клиент 100%.');
}
