const { query } = require('../../database/db');

// ============================================================
// Tier Service — единый источник правды по тарифам (Фаза 1)
// Читает конфиг из subscription_plans (редактируется в /admark).
// NULL в *_limit = безлимит (∞).
// ============================================================

let _cache = null;
let _cacheAt = 0;
const TTL_MS = 60 * 1000; // админ-правки подхватываются в течение минуты

async function _loadPlans() {
  if (_cache && Date.now() - _cacheAt < TTL_MS) return _cache;
  const { rows } = await query(`SELECT * FROM subscription_plans`);
  const map = {};
  for (const r of rows) map[r.key] = r;
  _cache = map;
  _cacheAt = Date.now();
  return map;
}

/** Сбросить кэш (вызывать после правки тарифов в админке). */
function invalidate() { _cache = null; }

/**
 * Определить ключ тарифа по строке пользователя.
 * Активная подписка = subscription_plan задан И subscription_expires в будущем.
 * @param {{subscription_plan?: string, subscription_expires?: string|Date}} user
 * @returns {'free'|'basic'|'pro'}
 */
function tierKeyFromUser(user) {
  if (user && user.subscription_plan && user.subscription_expires
      && new Date(user.subscription_expires) > new Date()) {
    return user.subscription_plan;
  }
  return 'free';
}

/**
 * Конфиг тарифа (лимиты/комиссия/кристаллы) для пользователя.
 * @param {object} user - строка users (нужны subscription_plan, subscription_expires)
 * @returns {Promise<object>} строка subscription_plans
 */
async function getTierLimits(user) {
  const plans = await _loadPlans();
  return plans[tierKeyFromUser(user)] || plans['free'];
}

/** То же, но по telegram_id (когда нет полной строки пользователя). */
async function getTierLimitsByTelegramId(telegramId) {
  const { rows } = await query(
    `SELECT subscription_plan, subscription_expires FROM users WHERE telegram_id = $1`,
    [telegramId]
  );
  return getTierLimits(rows[0] || {});
}

module.exports = {
  getTierLimits,
  getTierLimitsByTelegramId,
  tierKeyFromUser,
  invalidate,
};
