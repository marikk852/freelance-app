import { toNano, Address, WalletContractV4, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, internal } from '@ton/ton';
import { compile, NetworkProvider } from '@ton/blueprint';
import { EscrowContract, EscrowConfig } from '../wrappers/EscrowContract';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

// ============================================================
// Скрипт деплоя SafeDeal Escrow контракта
// Запуск: npx blueprint run scripts/deploy.ts
// ============================================================

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();

  ui.write('🚀 SafeDeal Escrow — Деплой контракта');
  ui.write('=====================================');

  // ---- Читаем параметры ----
  const clientAddrStr = await ui.input('Адрес клиента (UQ...):');
  const freelancerAddrStr = await ui.input('Адрес фрилансера (UQ...):');
  const amountTON = await ui.input('Сумма сделки в TON (напр. 5.5):');
  const deadlineDays = await ui.input('Дедлайн в днях (напр. 7):');

  const arbitratorAddress = process.env.ARBITRATOR_ADDRESS;
  if (!arbitratorAddress) {
    throw new Error('ARBITRATOR_ADDRESS не задан в .env');
  }

  const config: EscrowConfig = {
    clientAddr    : Address.parse(clientAddrStr),
    freelancerAddr: Address.parse(freelancerAddrStr),
    arbitratorAddr: Address.parse(arbitratorAddress),
    amountNano    : toNano(amountTON),
    feePercent    : Number(process.env.PLATFORM_FEE_PERCENT) || 2,
    deadline      : Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400,
  };

  // ---- Компилируем контракт ----
  ui.write('\n📦 Компиляция контракта...');
  const code = await compile('escrow');
  ui.write('✅ Контракт скомпилирован');

  // ---- Создаём экземпляр ----
  const escrow = EscrowContract.createFromConfig(config, code);

  ui.write(`\n📍 Адрес контракта: ${escrow.address.toString()}`);
  ui.write(`💰 Сумма сделки: ${fromNano(config.amountNano)} TON`);
  ui.write(`📅 Дедлайн: ${new Date(config.deadline * 1000).toLocaleString()}`);
  ui.write(`💸 Комиссия платформы: ${config.feePercent}%`);

  const confirm = await ui.input('\nДеплоить? (yes/no):');
  if (confirm.toLowerCase() !== 'yes') {
    ui.write('❌ Отменено');
    return;
  }

  // ---- Деплоим ----
  ui.write('\n⏳ Отправка транзакции деплоя...');
  await provider.deploy(escrow, toNano('0.05'));

  ui.write('✅ Контракт успешно задеплоен!');
  ui.write(`🔗 Адрес: ${escrow.address.toString()}`);
  ui.write('\n⚠️  Сохрани адрес контракта в базе данных!');
  ui.write(`tonContractAddress = "${escrow.address.toString()}"`);
}
