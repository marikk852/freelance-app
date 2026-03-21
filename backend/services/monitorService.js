const cron = require('node-cron');
const { query } = require('../../database/db');
const escrowService = require('./escrowService');
const notificationService = require('./notificationService');

// ============================================================
// Monitor Service — фоновый мониторинг смарт-контрактов
// Агент 4: опрашивает TON блокчейн каждые 30 секунд
// ============================================================

/**
 * Запустить все фоновые задачи мониторинга.
 * Вызывается при старте сервера.
 */
function startMonitoring() {
  // Проверяем новые депозиты каждые 30 секунд
  cron.schedule('*/30 * * * * *', monitorPendingDeposits);

  // Проверяем просроченные контракты каждые 5 минут
  cron.schedule('*/5 * * * *', checkExpiredContracts);

  // Напоминания о дедлайне каждый час
  cron.schedule('0 * * * *', sendDeadlineReminders);

  console.log('[Monitor] Фоновый мониторинг запущен');
}

/**
 * Мониторить контракты в статусе awaiting_payment.
 * При получении депозита — переводим в in_progress.
 */
async function monitorPendingDeposits() {
  try {
    const { rows } = await query(
      `SELECT c.id AS contract_id,
              c.title,
              r.client_id,
              r.freelancer_id,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       JOIN escrow e ON e.contract_id = c.id
       WHERE e.status = 'waiting_payment'
         AND c.ton_contract_address IS NOT NULL
       LIMIT 50`
    );

    for (const row of rows) {
      try {
        const status = await escrowService.monitorContract(row.contract_id);

        if (status === 'frozen') {
          // Уведомляем обоих участников
          await notificationService.notifyEscrowFrozen({
            clientTgId    : row.client_tg_id,
            freelancerTgId: row.freelancer_tg_id,
            contractTitle : row.title,
            contractId    : row.contract_id,
          });
        }
      } catch (err) {
        console.error(`[Monitor] Ошибка мониторинга ${row.contract_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Monitor] Ошибка monitorPendingDeposits:', err.message);
  }
}

/**
 * Проверить просроченные контракты.
 * Если дедлайн прошёл и депозит не получен — авто-отмена.
 * Если дедлайн прошёл и деньги заморожены — арбитр решает вручную.
 */
async function checkExpiredContracts() {
  try {
    const { rows } = await query(
      `SELECT c.id, c.title, c.deadline,
              r.client_id,
              uc.telegram_id AS client_tg_id
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN escrow e ON e.contract_id = c.id
       WHERE c.deadline < NOW()
         AND c.status = 'awaiting_payment'
         AND e.status = 'waiting_payment'`
    );

    for (const row of rows) {
      try {
        // Отменяем контракт ожидающий оплаты после дедлайна
        await query(
          `UPDATE contracts SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
        await query(
          `INSERT INTO audit_log (contract_id, action, details)
           VALUES ($1, 'auto_cancel', '{"reason": "deadline_passed_no_payment"}')`,
          [row.id]
        );

        await notificationService.notify(
          row.client_tg_id,
          'deadline_reminder',
          `⏰ Сделка *${row.title}* автоматически отменена — дедлайн прошёл без оплаты.`,
          {}
        );
      } catch (err) {
        console.error(`[Monitor] Ошибка checkExpired ${row.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Monitor] Ошибка checkExpiredContracts:', err.message);
  }
}

/**
 * Отправить напоминания о приближающемся дедлайне (за 24 часа).
 */
async function sendDeadlineReminders() {
  try {
    const { rows } = await query(
      `SELECT c.id, c.title, c.deadline,
              uf.telegram_id AS freelancer_tg_id,
              EXTRACT(EPOCH FROM (c.deadline - NOW()))/3600 AS hours_left
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.status = 'in_progress'
         AND c.deadline BETWEEN NOW() AND NOW() + INTERVAL '25 hours'
         AND c.deadline > NOW() + INTERVAL '23 hours'`
    );

    for (const row of rows) {
      await notificationService.notifyDeadlineReminder({
        freelancerTgId: row.freelancer_tg_id,
        contractTitle : row.title,
        hoursLeft     : Math.round(row.hours_left),
      });
    }
  } catch (err) {
    console.error('[Monitor] Ошибка sendDeadlineReminders:', err.message);
  }
}

module.exports = { startMonitoring };
