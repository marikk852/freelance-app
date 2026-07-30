import { toNano, fromNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { JettonMinter, JettonWallet } from '../wrappers/ReferenceJetton';

// ============================================================
// TESTNET ШАГ 1/2 — развернуть тестовый USD₮ и намайнить себе.
//
// На testnet нет настоящего Tether USD₮, поэтому деплоим ЭТАЛОННЫЙ
// TEP-74 jetton (тот же, что в e2e-тестах) как стенд-ин USD₮.
// Подключённый кошелёк = админ минтера И держатель токенов (клиент).
//
// Запуск:  cd contracts && npx blueprint run testnetUsdtSetup --testnet
// Нужно:   TON_API_KEY (testnet toncenter) в env + фондированный кошелёк.
// ============================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();
  const me = provider.sender().address;
  if (!me) throw new Error('Кошелёк не подключён');

  ui.write('🧪 TESTNET USD₮ — ШАГ 1/2: деплой тестового jetton + mint');
  ui.write('==========================================================');
  ui.write(`Кошелёк (админ/клиент): ${me.toString()}`);

  const minter = provider.open(JettonMinter.createFromConfig(me));
  ui.write(`\n📍 Адрес тестового USD₮-мастера: ${minter.address.toString()}`);

  // 1. Деплой минтера (если ещё не задеплоен)
  if (!(await provider.isContractDeployed(minter.address))) {
    ui.write('⏳ Деплой минтера...');
    await minter.sendDeploy(provider.sender(), toNano('0.5'));
    await provider.waitForDeploy(minter.address);
    ui.write('✅ Минтер задеплоен');
  } else {
    ui.write('ℹ️  Минтер уже задеплоен — пропускаю деплой');
  }

  // 2. Mint себе (сумма из env MINT_AMOUNT для неинтерактивного прогона, иначе спросить)
  const amountStr = process.env.MINT_AMOUNT ?? await ui.input('\nСколько тестовых USD₮ намайнить себе (напр. 1000):');
  const amountUsd = Number(amountStr);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error('Некорректная сумма');
  const jettonAmount = BigInt(Math.round(amountUsd * 1e6)); // 6 знаков

  ui.write('⏳ Mint...');
  await minter.sendMint(provider.sender(), me, jettonAmount, toNano('1'), toNano('0.25'));

  // 3. Ждём появления баланса на своём jetton-wallet
  const myJwAddr = await minter.getWalletAddress(me);
  const myJw = provider.open(JettonWallet.createFromAddress(myJwAddr));
  ui.write(`Жду зачисления на jetton-wallet ${myJwAddr.toString()} ...`);
  let balance = 0n;
  for (let i = 0; i < 20 && balance < jettonAmount; i++) {
    await sleep(3000);
    try { balance = await myJw.getJettonBalance(); } catch { /* ещё не активен */ }
    ui.write(`  ...баланс: ${(Number(balance) / 1e6).toFixed(2)} USD₮`);
  }

  if (balance < jettonAmount) {
    ui.write('⚠️  Баланс ещё не подтвердился — проверь в explorer чуть позже.');
  } else {
    ui.write(`✅ Намайнено ${(Number(balance) / 1e6).toFixed(2)} тестовых USD₮`);
  }

  ui.write('\n──────────────────────────────────────────────');
  ui.write('👉 ДАЛЬШЕ:');
  ui.write(`1) Прогон цикла эскроу:`);
  ui.write(`   TESTNET_USDT_MASTER=${minter.address.toString()} \\`);
  ui.write(`   npx blueprint run testnetUsdtCycle --testnet`);
  ui.write(`2) Для теста backend на testnet добавь в .env:`);
  ui.write(`   USDT_MASTER_ADDRESS=${minter.address.toString()}`);
  ui.write('──────────────────────────────────────────────');
}
