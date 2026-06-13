const cron = require('node-cron');
const { query } = require('../../database/db');
const escrowService = require('./escrowService');
const notificationService = require('./notificationService');
const tonService = require('./tonService');
const { fromNano, toNano } = require('@ton/ton');

// Порог баланса арбитра — алерт если меньше
const ARBITRATOR_LOW_BALANCE_TON = 1; // TON

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

  // FIX #4: Мониторинг баланса кошелька арбитра каждые 5 минут
  cron.schedule('*/5 * * * *', checkArbitratorBalance);

  // Жизненный цикл подписок (раз в день):
  // напоминание о продлении за ~3 дня + перевод просроченных в expired.
  // Авто-списания нет — в крипте оно невозможно без подписи пользователя.
  cron.schedule('0 10 * * *', sendSubscriptionRenewalReminders);
  cron.schedule('5 10 * * *', expireSubscriptions);

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

/**
 * FIX #4: Проверить баланс кошелька арбитра.
 * Если < ARBITRATOR_LOW_BALANCE_TON — уведомить ARBITRATOR_TELEGRAM_ID.
 * Без баланса на газ все release/refund/split будут падать.
 */
async function checkArbitratorBalance() {
  try {
    const balanceNano = await tonService.getArbitratorBalance();
    const balanceTon  = parseFloat(fromNano(balanceNano));

    if (balanceTon < ARBITRATOR_LOW_BALANCE_TON) {
      const arbitratorTgId = process.env.ARBITRATOR_TELEGRAM_ID;
      console.error(`[Monitor] 🚨 Критически низкий баланс арбитра: ${balanceTon} TON`);

      if (arbitratorTgId) {
        // Не спамим — проверяем что за последний час не было такого уведомления
        const { rows } = await query(
          `SELECT id FROM notifications n
           JOIN users u ON u.id = n.user_id
           WHERE u.telegram_id = $1 AND n.type = 'system_alert'
             AND n.created_at > NOW() - INTERVAL '1 hour'
           LIMIT 1`,
          [Number(arbitratorTgId)]
        );
        if (rows.length === 0) {
          const msg = `🚨 *НИЗКИЙ БАЛАНС АРБИТРА*\n\nТекущий баланс: *${balanceTon.toFixed(4)} TON*\nМинимум: *${ARBITRATOR_LOW_BALANCE_TON} TON*\n\nПополни кошелёк арбитра — иначе release/refund/split будут падать!`;
          await notificationService.notify(
            Number(arbitratorTgId),
            'system_alert',
            msg,
            { balanceTon, threshold: ARBITRATOR_LOW_BALANCE_TON }
          );
        }
      }
    } else {
      console.log(`[Monitor] Баланс арбитра: ${balanceTon.toFixed(4)} TON ✅`);
    }
  } catch (err) {
    // Не крашим мониторинг если TON API временно недоступен
    console.error('[Monitor] Ошибка checkArbitratorBalance:', err.message);
  }
}

/**
 * Напомнить о скором истечении подписки (за ~3 дня).
 * renewal_reminded защищает от повторов; авто-продления нет —
 * пользователь должен сам подписать новую транзакцию.
 */
async function sendSubscriptionRenewalReminders() {
  try {
    const { rows } = await query(
      `SELECT us.id, sp.name AS plan_name, u.telegram_id
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       JOIN users u ON u.id = us.user_id
       WHERE us.status = 'active'
         AND us.renewal_reminded = FALSE
         AND us.expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'`
    );

    for (const row of rows) {
      try {
        await notificationService.notify(
          Number(row.telegram_id),
          'subscription_renewal',
          `⏳ *Subscription expiring soon*\n\nYour *${row.plan_name}* plan ends in less than 3 days. Renew now to keep your badge, profile boost and monthly crystals without interruption.`,
          { inlineKeyboard: [[
            { text: '✦ Renew now', web_app: { url: `${process.env.WEBAPP_URL}?screen=subscription` } },
          ]] }
        );
        await query(
          `UPDATE user_subscriptions SET renewal_reminded = TRUE WHERE id = $1`,
          [row.id]
        );
      } catch (err) {
        console.error(`[Monitor] Ошибка напоминания подписки ${row.id}:`, err.message);
      }
    }

    if (rows.length > 0) console.log(`[Monitor] Отправлено ${rows.length} напоминаний о продлении`);
  } catch (err) {
    console.error('[Monitor] Ошибка sendSubscriptionRenewalReminders:', err.message);
  }
}

/**
 * Перевести просроченные подписки в status='expired' и сбросить
 * stale-колонки users.subscription_plan / subscription_expires.
 * Без этого подписка вечно числится 'active' в БД (ломает аналитику),
 * хотя /my и бейдж на фронте корректно фильтруют по expires_at.
 */
async function expireSubscriptions() {
  try {
    const { rows } = await query(
      `SELECT us.id, sp.name AS plan_name, u.telegram_id
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       JOIN users u ON u.id = us.user_id
       WHERE us.status = 'active' AND us.expires_at < NOW()`
    );
    if (rows.length === 0) return;

    // Помечаем просроченные (WHERE повторно проверяет дату — свежая покупка не заденется)
    await query(
      `UPDATE user_subscriptions SET status = 'expired'
       WHERE status = 'active' AND expires_at < NOW()`
    );

    // Сбрасываем stale-колонки только у тех, у кого НЕТ другой активной подписки
    await query(
      `UPDATE users u SET subscription_plan = NULL, subscription_expires = NULL
       WHERE u.subscription_expires < NOW()
         AND NOT EXISTS (
           SELECT 1 FROM user_subscriptions us
           WHERE us.user_id = u.id AND us.status = 'active' AND us.expires_at > NOW()
         )`
    );

    for (const row of rows) {
      try {
        await notificationService.notify(
          Number(row.telegram_id),
          'subscription_expired',
          `⌛ *Subscription ended*\n\nYour *${row.plan_name}* subscription has expired. Renew to bring back your badge, profile boost and monthly crystals.`,
          { inlineKeyboard: [[
            { text: '✦ Renew', web_app: { url: `${process.env.WEBAPP_URL}?screen=subscription` } },
          ]] }
        );
      } catch (err) {
        console.error(`[Monitor] Ошибка уведомления об истечении ${row.id}:`, err.message);
      }
    }

    console.log(`[Monitor] Истекло подписок: ${rows.length}`);
  } catch (err) {
    console.error('[Monitor] Ошибка expireSubscriptions:', err.message);
  }
}

module.exports = { startMonitoring };
