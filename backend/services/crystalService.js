const { query, transaction } = require('../../database/db');
const tierService = require('./tierService');

// ============================================================
// Crystal Service — soft-валюта (Фаза 2)
// Начисление по crystal_actions с тарифным множителем (+20%/+50%)
// и дневными потолками. Трата по crystal_shop_items (атомарно).
// Всё пишется в crystal_ledger. Конфиг редактируется в /admark.
// ============================================================

/**
 * Начислить кристаллы за действие (с множителем тарифа и дневным потолком).
 * Безопасна к повторам только если действие имеет daily_cap; иначе вызывающий
 * отвечает за идемпотентность (напр. одноразовые достижения).
 * @param {number} userId
 * @param {string} actionKey - ключ crystal_actions
 * @param {{ amountOverride?: number, meta?: object }} [opts]
 * @returns {Promise<number>} сколько начислено (0 если потолок/неактивно)
 */
async function award(userId, actionKey, opts = {}) {
  if (!userId) return 0;
  const { rows: acts } = await query(
    `SELECT amount, daily_cap, is_active FROM crystal_actions WHERE key = $1`, [actionKey]
  );
  const act = acts[0];
  if (!act || !act.is_active) return 0;

  // Дневной потолок: сколько раз сегодня уже начисляли это действие
  if (act.daily_cap != null) {
    const { rows: c } = await query(
      `SELECT COUNT(*)::int AS n FROM crystal_ledger
       WHERE user_id = $1 AND action_key = $2 AND kind = 'earn'
         AND created_at >= CURRENT_DATE`,
      [userId, actionKey]
    );
    if (c[0].n >= act.daily_cap) return 0;
  }

  const base = opts.amountOverride != null ? opts.amountOverride : act.amount;
  if (base <= 0) return 0;

  // Тарифный множитель (+20% BASIC / +50% PRO)
  const tier = await tierService.getTierLimitsByUserId(userId);
  const mult = 1 + (Number(tier.earning_bonus_percent) || 0) / 100;
  const total = Math.round(base * mult);

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO crystal_ledger (user_id, action_key, amount, kind, meta)
       VALUES ($1, $2, $3, 'earn', $4)`,
      [userId, actionKey, total, opts.meta ? JSON.stringify(opts.meta) : null]
    );
    await client.query(
      `UPDATE users SET safe_crystals = safe_crystals + $1 WHERE id = $2`,
      [total, userId]
    );
  });
  return total;
}

/**
 * Выдать кристаллы напрямую (грант/раздача/стартовый бонус) — без множителя.
 * @param {number} userId
 * @param {number} amount
 * @param {{ kind?: string, action_key?: string, meta?: object }} [opts]
 */
async function grant(userId, amount, opts = {}) {
  if (!userId || !amount || amount <= 0) return 0;
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO crystal_ledger (user_id, action_key, amount, kind, meta)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, opts.action_key || null, amount, opts.kind || 'grant',
       opts.meta ? JSON.stringify(opts.meta) : null]
    );
    await client.query(
      `UPDATE users SET safe_crystals = safe_crystals + $1 WHERE id = $2`,
      [amount, userId]
    );
  });
  return amount;
}

/**
 * Потратить кристаллы на товар магазина (атомарно, только soft-товары).
 * @param {number} userId
 * @param {string} itemKey - ключ crystal_shop_items
 * @returns {Promise<{ spent: number, balance: number, label: string }>}
 * @throws Error если товар недоступен или не хватает кристаллов
 */
async function spend(userId, itemKey) {
  const { rows: items } = await query(
    `SELECT label, cost, is_active FROM crystal_shop_items WHERE key = $1`, [itemKey]
  );
  const item = items[0];
  if (!item || !item.is_active) throw new Error('Item not available');

  let balance;
  await transaction(async (client) => {
    // Списываем ТОЛЬКО если хватает — атомарно в одном UPDATE
    const { rows } = await client.query(
      `UPDATE users SET safe_crystals = safe_crystals - $1
       WHERE id = $2 AND safe_crystals >= $1
       RETURNING safe_crystals`,
      [item.cost, userId]
    );
    if (!rows[0]) throw new Error('Insufficient crystals');
    balance = rows[0].safe_crystals;
    await client.query(
      `INSERT INTO crystal_ledger (user_id, action_key, amount, kind, meta)
       VALUES ($1, $2, $3, 'spend', $4)`,
      [userId, itemKey, -item.cost, JSON.stringify({ label: item.label })]
    );
  });
  return { spent: item.cost, balance, label: item.label };
}

/** Баланс + последние операции для профиля. */
async function getBalanceAndHistory(userId, limit = 20) {
  const { rows: u } = await query(`SELECT safe_crystals FROM users WHERE id = $1`, [userId]);
  const { rows: ledger } = await query(
    `SELECT action_key, amount, kind, meta, created_at
     FROM crystal_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return { balance: u[0] ? u[0].safe_crystals : 0, ledger };
}

module.exports = { award, grant, spend, getBalanceAndHistory };
