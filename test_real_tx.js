#!/usr/bin/env node
// ============================================================
// SafeDeal — Тест реальной транзакции на TON testnet
// Запуск: node test_real_tx.js
// ============================================================

require('dotenv').config({ path: './.env' });
const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

const BASE_URL  = 'https://freelance-app-production.up.railway.app';
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN не найден'); process.exit(1); }

function makeInitData(user) {
  const authDate = Math.floor(Date.now() / 1000);
  const userStr  = JSON.stringify(user);
  const params   = new URLSearchParams({ auth_date: String(authDate), user: userStr });
  const dcs = Array.from(params.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const sk   = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', sk).update(dcs).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

function request(method, path, body, initData) {
  return new Promise((resolve, reject) => {
    const url     = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib     = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = lib.request({
      hostname: url.hostname,
      port    : url.port || (isHttps ? 443 : 80),
      path    : url.pathname + url.search,
      method, headers,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function log(icon, msg, data) {
  const time = new Date().toLocaleTimeString('ru-RU');
  console.log(`[${time}] ${icon} ${msg}`);
  if (data) console.log('   ', JSON.stringify(data, null, 2).replace(/\n/g, '\n    '));
}

function ok(r, label) {
  if (r.status >= 400) { log('❌', `${label} FAILED (${r.status})`, r.body); process.exit(1); }
  return r.body;
}

const CLIENT     = { id: 333000333, username: 'realtest_client',     first_name: 'Real', last_name: 'Client' };
const FREELANCER = { id: 444000444, username: 'realtest_freelancer',  first_name: 'Real', last_name: 'Freelancer' };

const clientAuth     = makeInitData(CLIENT);
const freelancerAuth = makeInitData(FREELANCER);

async function pollStatus(contractId, targetStatus, maxWaitSec = 300) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWaitSec) {
    const r = await request('GET', `/api/contracts/${contractId}`, null, clientAuth);
    if (r.status === 200) {
      const s = r.body.status;
      const e = r.body.escrow_status;
      log('🔄', `Status: ${s} | Escrow: ${e || '—'}`);
      if (s === targetStatus) return r.body;
      if (s === 'disputed' || s === 'completed') { log('⚠️', `Unexpected status: ${s}`); return r.body; }
    }
    await new Promise(res => setTimeout(res, 15000));
  }
  log('⏰', `Timeout waiting for status: ${targetStatus}`);
  return null;
}

async function run() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   SafeDeal — REAL TESTNET TX TEST      ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 1. Получаем профили
  log('👤', 'Клиент...');
  await request('GET', '/api/users/me', null, clientAuth);
  log('👤', 'Фрилансер...');
  await request('GET', '/api/users/me', null, freelancerAuth);

  // 2. Создаём контракт (минимальная сумма $1)
  log('📜', 'Создаём контракт ($1 TON)...');
  const deadline = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const contract = ok(await request('POST', '/api/contracts', {
    title      : 'Тест реальной TX',
    description: 'Тест полного цикла реальной транзакции на testnet',
    amount_usd : 1,
    currency   : 'TON',
    deadline,
    criteria: [
      { text: 'Критерий 1 — функциональность', required: true },
      { text: 'Критерий 2 — качество кода',    required: true },
      { text: 'Критерий 3 — документация',      required: false },
    ],
  }, clientAuth), 'Создание контракта');

  const contractId = contract.contractId;
  log('✅', `Контракт: ${contractId}`);

  // 3. Фрилансер подписывает
  log('✍️',  'Фрилансер подписывает...');
  ok(await request('POST', `/api/contracts/${contractId}/sign`, { role: 'freelancer' }, freelancerAuth), 'Подпись');
  log('✅', 'Подписано. Статус: signed');

  // 4. Деплоим TON смарт-контракт (РЕАЛЬНЫЙ)
  log('🚀', 'Деплоим смарт-контракт на TON testnet...');
  const deployed = ok(await request('POST', `/api/contracts/${contractId}/deploy`, {}, clientAuth), 'Деплой');
  log('✅', 'Контракт задеплоен!', {
    address    : deployed.tonContractAddress,
    cryptoAmount: deployed.cryptoAmount,
    totalToSend : (deployed.cryptoAmount + 0.15).toFixed(6) + ' TON',
  });

  const addr   = deployed.tonContractAddress;
  const amount = (deployed.cryptoAmount + 0.15).toFixed(6);

  // Payload OP_DEPOSIT = 1
  const payload = 'te6cckEBAQEABgAACAAAAAHgg8T9';

  console.log('\n' + '═'.repeat(60));
  console.log('  📱 ОТПРАВЬ ВРУЧНУЮ ИЗ TONKEEPER (TESTNET):');
  console.log('═'.repeat(60));
  console.log(`  Адрес:   ${addr}`);
  console.log(`  Сумма:   ${amount} TON`);
  console.log(`  Payload: ${payload}`);
  console.log(`  Сеть:    TESTNET`);
  console.log('═'.repeat(60));
  console.log('  Или открой mini app и пройди Payment экран.');
  console.log('═'.repeat(60) + '\n');

  // 5. Ждём заморозку (мониторим каждые 15 секунд)
  log('👀', 'Мониторю блокчейн... (до 5 минут)');
  const frozen = await pollStatus(contractId, 'in_progress', 300);

  if (!frozen || frozen.status !== 'in_progress') {
    log('❌', 'Средства не заморожены за 5 минут. Тест остановлен.');
    log('ℹ️', 'Убедись что Railway получил подтверждение. Контракт ID:', { contractId });
    process.exit(1);
  }

  log('🔒', 'СРЕДСТВА ЗАМОРОЖЕНЫ! Escrow: ' + frozen.escrow_status);

  // 6. Фрилансер сдаёт работу
  log('📦', 'Фрилансер сдаёт работу...');
  const delivery = ok(await request('POST', '/api/deliveries', {
    contractId,
    description: 'Реальная тестовая сдача работы. Все критерии выполнены.',
    links: JSON.stringify([{ url: 'https://github.com/test', label: 'Репо' }]),
  }, freelancerAuth), 'Сдача работы');
  const deliveryId = delivery.deliveryId;
  log('✅', `Работа сдана: ${deliveryId}`);

  // 7. Клиент одобряет → release на блокчейн
  log('✅', 'Клиент одобряет работу → release escrow...');
  const approved = ok(await request('POST', `/api/deliveries/${deliveryId}/approve`, null, clientAuth), 'Одобрение');
  log('🎉', 'Работа одобрена! Транзакция отправлена.', { txHash: approved.txHash });

  // 8. Финальный статус
  const final = ok(await request('GET', `/api/contracts/${contractId}`, null, clientAuth), 'Финал');
  log('🏆', `ИТОГ: ${final.status} | Escrow: ${final.escrow_status}`);

  if (final.status === 'completed' && final.escrow_status === 'released') {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   ✅ РЕАЛЬНАЯ ТРАНЗАКЦИЯ ПРОШЛА!       ║');
    console.log('║   Деньги поступили фрилансеру.         ║');
    console.log('╚════════════════════════════════════════╝\n');
  } else {
    console.log('\n⚠️  Финальный статус неожиданный:', final.status, final.escrow_status);
  }
}

run().catch(err => { console.error('❌ Ошибка:', err); process.exit(1); });
