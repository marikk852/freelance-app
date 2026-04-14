#!/usr/bin/env node
// ============================================================
// SafeDeal — Симуляция полной сделки между двумя юзерами
// Запуск: node simulate_deal.js
// ============================================================

require('dotenv').config({ path: './.env' });
const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

const BASE_URL  = process.env.SIMULATE_URL || 'https://freelance-app-production.up.railway.app';
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN не найден в .env'); process.exit(1); }

// ---------- Генерация валидного Telegram initData ----------
function makeInitData(user) {
  const authDate = Math.floor(Date.now() / 1000);
  const userStr  = JSON.stringify(user);

  const params = new URLSearchParams({
    auth_date: String(authDate),
    user     : userStr,
  });

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN).digest();

  const hash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}

// ---------- HTTP клиент ----------
function request(method, path, body, initData) {
  return new Promise((resolve, reject) => {
    const url     = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type'           : 'application/json',
      'X-Telegram-Init-Data'   : initData,
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = lib.request({
      hostname: url.hostname,
      path    : url.pathname + url.search,
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
  console.log(`${icon} ${msg}`);
  if (data) console.log('   ', JSON.stringify(data, null, 2).split('\n').join('\n    '));
}

function ok(r, label) {
  if (r.status >= 400) {
    log('❌', `${label} FAILED (${r.status})`, r.body);
    process.exit(1);
  }
  return r.body;
}

// ---------- Юзеры ----------
const CLIENT = {
  id        : 111000111,
  username  : 'test_client',
  first_name: 'Test',
  last_name : 'Client',
};

const FREELANCER = {
  id        : 222000222,
  username  : 'test_freelancer',
  first_name: 'Test',
  last_name : 'Freelancer',
};

const clientAuth     = makeInitData(CLIENT);
const freelancerAuth = makeInitData(FREELANCER);

// ---------- Симуляция ----------
async function simulate() {
  console.log('\n╔══════════════════════════════════╗');
  console.log('║   SafeDeal Deal Simulation       ║');
  console.log('╚══════════════════════════════════╝\n');

  // 1. Регистрация клиента
  log('👤', 'Регистрируем клиента...');
  const clientRes = await request('GET', '/api/users/me', null, clientAuth);
  if (clientRes.status === 404 || clientRes.status === 401) {
    // Пробуем через /api/users (auto-register on first request)
    log('ℹ️', 'Клиент ещё не зарегистрирован, создаём...');
  } else {
    log('✅', 'Клиент', clientRes.body);
  }

  // 2. Регистрация фрилансера
  log('👤', 'Регистрируем фрилансера...');
  const flRes = await request('GET', '/api/users/me', null, freelancerAuth);
  if (flRes.status !== 200) {
    log('ℹ️', 'Фрилансер ещё не зарегистрирован');
  } else {
    log('✅', 'Фрилансер', flRes.body);
  }

  // 3. Создаём контракт (клиент)
  log('📜', 'Создаём контракт...');
  const deadline = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const contractRes = ok(await request('POST', '/api/contracts', {
    title      : 'Тестовый лендинг на React',
    description: 'Разработать одностраничный сайт с анимациями и адаптивной вёрсткой',
    amount_usd : 50,
    currency   : 'TON',
    deadline,
    criteria: [
      { text: 'Адаптивная вёрстка (mobile+desktop)', required: true  },
      { text: 'Анимации при скролле',                required: true  },
      { text: 'Форма обратной связи',                required: false },
    ],
  }, clientAuth), 'Создание контракта');

  const contractId = contractRes.contract?.id || contractRes.id;
  const inviteLink = contractRes.invite_link;
  log('✅', `Контракт создан: ${contractId}`);
  log('🔗', `Invite link: ${inviteLink}`);

  // 4. Фрилансер принимает приглашение
  log('✍️', 'Фрилансер подписывает контракт...');
  const signRes = ok(await request('POST', `/api/contracts/${contractId}/sign`, {
    role: 'freelancer',
  }, freelancerAuth), 'Подпись фрилансера');
  log('✅', 'Фрилансер подписал', signRes);

  // 5. Клиент подписывает
  log('✍️', 'Клиент подписывает контракт...');
  const signClientRes = ok(await request('POST', `/api/contracts/${contractId}/sign`, {
    role: 'client',
  }, clientAuth), 'Подпись клиента');
  log('✅', 'Клиент подписал', signClientRes);

  // 6. Проверяем статус сделки
  log('🔍', 'Проверяем статус контракта...');
  const statusRes = ok(await request('GET', `/api/contracts/${contractId}`, null, clientAuth), 'Статус');
  log('📊', `Статус: ${statusRes.status}`, {
    title       : statusRes.title,
    amount      : `$${statusRes.amount_usd} ${statusRes.currency}`,
    escrow      : statusRes.escrow_status,
  });

  // 7. Сдача работы (фрилансер)
  log('📦', 'Фрилансер сдаёт работу (текстовый отчёт)...');
  const deliverRes = ok(await request('POST', '/api/deliveries', {
    contract_id : contractId,
    description : 'Лендинг готов. Все критерии выполнены. Ссылка: https://example.com',
    links       : [{ url: 'https://example.com', label: 'Готовый сайт' }],
    files       : [],
  }, freelancerAuth), 'Сдача работы');
  const deliveryId = deliverRes.id || deliverRes.delivery?.id;
  log('✅', `Работа сдана: ${deliveryId}`);

  // 8. Клиент одобряет
  log('✅', 'Клиент проверяет и одобряет работу...');
  const approveRes = ok(await request('POST', `/api/deliveries/${deliveryId}/approve`, null, clientAuth), 'Одобрение');
  log('🎉', 'Работа одобрена!', approveRes);

  // 9. Финальный статус
  log('🔍', 'Финальный статус...');
  const finalRes = ok(await request('GET', `/api/contracts/${contractId}`, null, clientAuth), 'Финал');
  log('🏆', `Итог: ${finalRes.status}`, {
    title : finalRes.title,
    escrow: finalRes.escrow_status,
  });

  console.log('\n╔══════════════════════════════════╗');
  console.log('║   Симуляция завершена!           ║');
  console.log('╚══════════════════════════════════╝\n');
}

simulate().catch(err => {
  console.error('❌ Ошибка симуляции:', err.message);
  process.exit(1);
});
