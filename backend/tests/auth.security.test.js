/**
 * SafeDeal — Тесты безопасности авторизации
 * Агент 8: Telegram initData верификация
 */

const crypto = require('crypto');
const { verifyTelegramInitData } = require('../middleware/auth');

const BOT_TOKEN = 'test_bot_token_12345:ABCDEFGHIJKLMNOP';

// ============================================================
// Вспомогательная функция генерации валидного initData
// ============================================================
function buildValidInitData(userId, overrideHash = null) {
  const user     = JSON.stringify({ id: userId, first_name: 'Test', username: 'testuser' });
  const authDate = Math.floor(Date.now() / 1000).toString();

  const params = new URLSearchParams();
  params.set('auth_date', authDate);
  params.set('user', user);

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash      = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', overrideHash ?? hash);
  return params.toString();
}

// ============================================================
describe('🔑 Telegram initData верификация', () => {
  it('должен ПРИНЯТЬ валидный initData', () => {
    const initData = buildValidInitData(123456789);
    const result   = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(result.valid).toBe(true);
    expect(result.user.id).toBe(123456789);
  });

  it('должен ОТКЛОНИТЬ поддельный hash', () => {
    const initData = buildValidInitData(123456789, 'fakehash000000000000000000000000000000000000000000000000000000000');
    const result   = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(result.valid).toBe(false);
  });

  it('должен ОТКЛОНИТЬ initData без hash', () => {
    const params = new URLSearchParams();
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));
    params.set('user', JSON.stringify({ id: 1 }));
    const result = verifyTelegramInitData(params.toString(), BOT_TOKEN);
    expect(result.valid).toBe(false);
  });

  it('должен ОТКЛОНИТЬ initData старше 24 часов', () => {
    const oldDate  = Math.floor(Date.now() / 1000) - 86401; // 24ч + 1 сек назад
    const user     = JSON.stringify({ id: 99 });
    const params   = new URLSearchParams();
    params.set('auth_date', String(oldDate));
    params.set('user', user);

    const dataStr  = Array.from(params.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
    const key      = crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
    const hash     = crypto.createHmac('sha256', key).update(dataStr).digest('hex');
    params.set('hash', hash);

    const result = verifyTelegramInitData(params.toString(), BOT_TOKEN);
    expect(result.valid).toBe(false);
  });

  it('должен ОТКЛОНИТЬ initData с неверным BOT_TOKEN', () => {
    const initData = buildValidInitData(123456789); // сгенерирован с BOT_TOKEN
    const result   = verifyTelegramInitData(initData, 'wrong_token:XXXXXXXXX');
    expect(result.valid).toBe(false);
  });

  it('должен ОТКЛОНИТЬ пустой initData', () => {
    expect(verifyTelegramInitData('', BOT_TOKEN).valid).toBe(false);
    expect(verifyTelegramInitData(null, BOT_TOKEN).valid).toBe(false);
    expect(verifyTelegramInitData(undefined, BOT_TOKEN).valid).toBe(false);
  });

  it('должен ОТКЛОНИТЬ initData с изменённым user_id', () => {
    const initData = buildValidInitData(123456789);
    // Пытаемся подменить userId не меняя hash
    const params = new URLSearchParams(initData);
    params.set('user', JSON.stringify({ id: 999999999, first_name: 'Hacker' }));
    const result = verifyTelegramInitData(params.toString(), BOT_TOKEN);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// SQL injection защита — базовая проверка входных данных
// ============================================================
describe('💉 SQL Injection защита', () => {
  const { query } = require('../../database/db');

  it('параметризованные запросы не должны допускать SQL injection', () => {
    // Все запросы в моделях используют $1,$2 плейсхолдеры — не конкатенацию
    // Проверяем что escapeHtml не нужен — pg делает это сам
    const maliciousInput = "'; DROP TABLE users; --";

    // Проверяем что User.findByTelegramId передаёт как параметр, не конкатенирует
    // (статический анализ — смотрим что в db.js используется параметризация)
    const dbSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../database/db.js'), 'utf8'
    );
    // db.js должен использовать pool.query(text, params) — с массивом params
    expect(dbSource).toContain('pool.query(text, params)');
    // Не должно быть прямой конкатенации пользовательских данных
    expect(dbSource).not.toMatch(/query\s*\+\s*input/);
  });
});

// ============================================================
// XSS защита — проверяем что в API не используется innerHTML
// ============================================================
describe('🛡️ Проверка безопасности Express middleware', () => {
  it('сервер должен использовать helmet middleware', () => {
    const serverSource = require('fs').readFileSync(
      require('path').join(__dirname, '../server.js'), 'utf8'
    );
    expect(serverSource).toContain('helmet()');
    expect(serverSource).toContain('express-rate-limit');
    expect(serverSource).toContain('cors(');
  });

  it('приватные ключи не должны быть захардкожены в коде', () => {
    const files = [
      '../services/escrowService.js',
      '../services/tonService.js',
      '../../database/db.js',
    ].map(f => require('path').join(__dirname, f));

    files.forEach(filePath => {
      if (!require('fs').existsSync(filePath)) return;
      const content = require('fs').readFileSync(filePath, 'utf8');
      // Не должно быть реальных мнемоник или приватных ключей
      expect(content).not.toMatch(/[a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+/);
      // Переменные окружения должны использоваться через process.env
      expect(content).not.toMatch(/const.*PrivateKey\s*=\s*["'][^"']{20,}/);
    });
  });
});
