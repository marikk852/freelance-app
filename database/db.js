const { Pool } = require('pg');

// ============================================================
// SafeDeal — Подключение к PostgreSQL
// Используем пул соединений для production нагрузки
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                // максимум соединений в пуле
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// Логируем ошибки пула (не крашим процесс)
pool.on('error', (err) => {
  console.error('[DB] Неожиданная ошибка пула:', err.message);
});

/**
 * Выполнить SQL запрос с параметрами.
 * @param {string} text - SQL строка с $1, $2 плейсхолдерами
 * @param {Array}  params - массив параметров
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    // Логируем медленные запросы (>500ms)
    if (duration > 500) {
      console.warn(`[DB] Медленный запрос (${duration}ms):`, text.slice(0, 80));
    }
    return result;
  } catch (err) {
    console.error('[DB] Ошибка запроса:', err.message, '\nSQL:', text.slice(0, 120));
    throw err;
  }
}

/**
 * Получить соединение из пула (для транзакций).
 * Обязательно вызвать client.release() после использования.
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  return pool.connect();
}

/**
 * Выполнить несколько запросов в одной транзакции.
 * При ошибке автоматически делает ROLLBACK.
 * @param {Function} callback - async (client) => { ... }
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Проверить соединение с базой данных.
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { query, getClient, transaction, healthCheck, pool };
