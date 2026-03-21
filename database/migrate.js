require('dotenv').config({ path: '../.env' });
const fs   = require('fs');
const path = require('path');
const { pool } = require('./db');

// ============================================================
// Скрипт миграций SafeDeal
// Запуск: node database/migrate.js
// ============================================================

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Таблица для отслеживания выполненных миграций
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(256) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Получить список уже применённых миграций
    const { rows: applied } = await client.query(
      'SELECT filename FROM _migrations ORDER BY filename'
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    // Получить все .sql файлы в порядке имён
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} (уже применена)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`  ⏳ Применяю ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`  ✅ ${file} применена`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Ошибка в ${file}:`, err.message);
        throw err;
      }
    }

    if (count === 0) {
      console.log('\nВсе миграции уже применены.');
    } else {
      console.log(`\nПрименено ${count} миграций.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Ошибка миграции:', err.message);
  process.exit(1);
});
