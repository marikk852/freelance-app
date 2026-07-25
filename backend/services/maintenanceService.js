// ============================================================
// Maintenance service — режим техработ + белый список доступа
// Конфиг хранится в platform_settings (ключи maintenance_*),
// читается с кэшем 15с. Управляется из /admark → Settings.
// ============================================================
const { query } = require('../../database/db');

let cache = null;
let cacheAt = 0;
const TTL_MS = 15_000;

/**
 * Читает конфиг техработ из platform_settings (с кэшем 15с).
 * @returns {Promise<{ enabled: boolean, message: string, allowlist: string[] }>}
 */
async function getConfig() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;

  const { rows } = await query(
    `SELECT key, value FROM platform_settings
     WHERE key IN ('maintenance_mode', 'maintenance_message', 'maintenance_allowlist')`
  );
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));

  let allowlist = [];
  try {
    const parsed = JSON.parse(s.maintenance_allowlist || '[]');
    if (Array.isArray(parsed)) allowlist = parsed.map(String);
  } catch { /* битый JSON → пустой список */ }

  cache = {
    enabled : s.maintenance_mode === 'true',
    message : s.maintenance_message || '',
    allowlist,
  };
  cacheAt = Date.now();
  return cache;
}

/**
 * Имеет ли пользователь доступ во время техработ.
 * Доступ есть у тех, кто в белом списке, и у арбитра (защита от самоблокировки).
 */
function canAccess(cfg, telegramId) {
  const id  = String(telegramId || '');
  if (!id) return false;
  const arb = String(process.env.ARBITRATOR_TELEGRAM_ID || '');
  return cfg.allowlist.includes(id) || (arb !== '' && id === arb);
}

/** Сбросить кэш (вызывается после сохранения настроек в админке). */
function bustCache() { cache = null; cacheAt = 0; }

module.exports = { getConfig, canAccess, bustCache };
