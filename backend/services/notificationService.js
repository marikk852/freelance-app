const { query } = require('../../database/db');

// ============================================================
// Notification Service — отправка Telegram уведомлений
// Агент 4: используется escrowService для нотификаций
// ============================================================

let _bot = null;

/**
 * Установить экземпляр бота для отправки уведомлений.
 * Вызывается при инициализации бота.
 * @param {import('telegraf').Telegraf} bot
 */
function setBot(bot) {
  _bot = bot;
}

/**
 * Отправить уведомление пользователю через Telegram + сохранить в БД.
 * @param {number} telegramId - Telegram ID пользователя
 * @param {string} type       - тип уведомления
 * @param {string} message    - текст сообщения (Markdown)
 * @param {Object} payload    - дополнительные данные (для кнопок)
 */
async function notify(telegramId, type, message, payload = {}) {
  // Сохраняем в БД
  try {
    const { rows } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`,
      [telegramId]
    );
    if (rows[0]) {
      await query(
        `INSERT INTO notifications (user_id, type, message, payload)
         VALUES ($1, $2, $3, $4)`,
        [rows[0].id, type, message, JSON.stringify(payload)]
      );
    }
  } catch (err) {
    console.error('[Notify] Ошибка сохранения уведомления в БД:', err.message);
  }

  // Отправляем через Telegram
  if (_bot) {
    try {
      await _bot.telegram.sendMessage(telegramId, message, {
        parse_mode : 'Markdown',
        reply_markup: payload.inlineKeyboard
          ? { inline_keyboard: payload.inlineKeyboard }
          : undefined,
      });
    } catch (err) {
      console.error(`[Notify] Ошибка отправки в Telegram (${telegramId}):`, err.message);
    }
  }
}

// ============================================================
// Готовые уведомления для ключевых событий сделки
// ============================================================

/** Уведомить клиента что деньги заморожены, фрилансера — начинай работу */
async function notifyEscrowFrozen({ clientTgId, freelancerTgId, contractTitle, contractId }) {
  await notify(
    clientTgId,
    'payment_received',
    `🔒 *Деньги заморожены*\n\nСделка: *${contractTitle}*\nФрилансер начинает работу. Вы получите уведомление когда работа будет сдана.`,
    { contractId }
  );
  await notify(
    freelancerTgId,
    'payment_received',
    `✅ *Оплата получена*\n\nСделка: *${contractTitle}*\nДеньги заморожены в смарт-контракте. Начинай работу! 🚀`,
    { contractId }
  );
}

/** Уведомить клиента о сдаче работы */
async function notifyWorkSubmitted({ clientTgId, contractTitle, contractId }) {
  await notify(
    clientTgId,
    'work_submitted',
    `📦 *Работа сдана на проверку*\n\nСделка: *${contractTitle}*\nПроверь результат и прими решение.`,
    {
      contractId,
      inlineKeyboard: [[
        { text: '🔍 Проверить', callback_data: `review_${contractId}` },
      ]],
    }
  );
}

/** Уведомить фрилансера о принятии работы */
async function notifyWorkApproved({ freelancerTgId, contractTitle, amount, currency }) {
  await notify(
    freelancerTgId,
    'work_approved',
    `🎉 *Работа принята!*\n\nСделка: *${contractTitle}*\n💰 *${amount} ${currency}* отправлено на ваш кошелёк.\n\n+200 XP начислено!`,
    {}
  );
}

/** Уведомить фрилансера об отклонении работы */
async function notifyWorkRejected({ freelancerTgId, contractTitle, comment }) {
  await notify(
    freelancerTgId,
    'work_rejected',
    `🔄 *Нужны правки*\n\nСделка: *${contractTitle}*\n\n📝 Комментарий клиента:\n${comment}`,
    {}
  );
}

/** Уведомить обоих об открытии спора */
async function notifyDisputeOpened({ clientTgId, freelancerTgId, contractTitle, reason }) {
  const msg = `⚖️ *Открыт спор*\n\nСделка: *${contractTitle}*\nПричина: ${reason}\n\nАрбитр рассмотрит спор в течение 24 часов.`;
  await notify(clientTgId,     'dispute_opened', msg, {});
  await notify(freelancerTgId, 'dispute_opened', msg, {});
}

/** Уведомить обоих о решении спора */
async function notifyDisputeResolved({ clientTgId, freelancerTgId, contractTitle, decision, splitPercent }) {
  let decisionText;
  if (decision === 'client_wins')     decisionText = '💙 Клиент получает полный возврат';
  else if (decision === 'freelancer_wins') decisionText = '💚 Фрилансер получает полную оплату';
  else decisionText = `⚖️ Раздел: ${splitPercent}% фрилансеру, ${100 - splitPercent}% клиенту`;

  const msg = `✅ *Спор разрешён*\n\nСделка: *${contractTitle}*\n${decisionText}`;
  await notify(clientTgId,     'dispute_resolved', msg, {});
  await notify(freelancerTgId, 'dispute_resolved', msg, {});
}

/** Напоминание о приближающемся дедлайне (за 24 часа) */
async function notifyDeadlineReminder({ freelancerTgId, contractTitle, hoursLeft }) {
  await notify(
    freelancerTgId,
    'deadline_reminder',
    `⏰ *Дедлайн через ${hoursLeft} часов*\n\nСделка: *${contractTitle}*\nНе забудь сдать работу вовремя!`,
    {}
  );
}

module.exports = {
  setBot,
  notify,
  notifyEscrowFrozen,
  notifyWorkSubmitted,
  notifyWorkApproved,
  notifyWorkRejected,
  notifyDisputeOpened,
  notifyDisputeResolved,
  notifyDeadlineReminder,
};
