const { query } = require('../../database/db');
const notificationService = require('../../backend/services/notificationService');

// ============================================================
// Handler: Текстовые сообщения (ответы на force_reply)
// ============================================================

/**
 * Обработчик входящих текстовых сообщений.
 * Используется для multi-step флоу (reject комментарий, спор).
 */
async function handleMessage(ctx) {
  const session = ctx.session || {};
  const text    = ctx.message?.text;

  if (!text) return;

  // ---- Ответ с комментарием для reject delivery ----
  if (session.pendingReject) {
    const deliveryId = session.pendingReject;
    delete ctx.session.pendingReject;

    try {
      const { rows } = await query(
        `SELECT d.contract_id, c.title,
                uf.telegram_id AS freelancer_tg_id
         FROM deliveries d
         JOIN contracts c ON c.id = d.contract_id
         JOIN rooms r ON r.id = c.room_id
         JOIN users uf ON uf.id = r.freelancer_id
         WHERE d.id = $1`,
        [deliveryId]
      );
      if (!rows[0]) return ctx.reply('❌ Delivery не найден');

      await query(
        `UPDATE deliveries
         SET status = 'rejected', review_comment = $2, reviewed_at = NOW()
         WHERE id = $1`,
        [deliveryId, text]
      );
      await query(
        `UPDATE contracts SET status = 'in_progress', updated_at = NOW()
         WHERE id = $1`,
        [rows[0].contract_id]
      );

      await notificationService.notifyWorkRejected({
        freelancerTgId: rows[0].freelancer_tg_id,
        contractTitle : rows[0].title,
        comment       : text,
      });

      return ctx.reply(
        '✅ Комментарий отправлен фрилансеру. Ожидай исправлений.',
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (err) {
      console.error('[Bot] handleMessage reject error:', err.message);
      return ctx.reply('Ошибка отклонения работы.');
    }
  }

  // ---- Причина спора ----
  if (session.pendingDispute) {
    const contractId = session.pendingDispute;
    delete ctx.session.pendingDispute;

    try {
      const { rows: userRows } = await query(
        'SELECT id FROM users WHERE telegram_id = $1', [ctx.from.id]
      );
      if (!userRows[0]) return ctx.reply('Ошибка: пользователь не найден.');

      await query(
        `INSERT INTO disputes (contract_id, opened_by, reason)
         VALUES ($1, $2, $3)`,
        [contractId, userRows[0].id, text]
      );
      await query(
        `UPDATE contracts SET status = 'disputed', updated_at = NOW()
         WHERE id = $1`,
        [contractId]
      );

      // Уведомляем обе стороны
      const { rows } = await query(
        `SELECT c.title,
                uc.telegram_id AS client_tg_id,
                uf.telegram_id AS freelancer_tg_id
         FROM contracts c
         JOIN rooms r ON r.id = c.room_id
         JOIN users uc ON uc.id = r.client_id
         JOIN users uf ON uf.id = r.freelancer_id
         WHERE c.id = $1`,
        [contractId]
      );
      if (rows[0]) {
        await notificationService.notifyDisputeOpened({
          clientTgId    : rows[0].client_tg_id,
          freelancerTgId: rows[0].freelancer_tg_id,
          contractTitle : rows[0].title,
          reason        : text,
        });
      }

      return ctx.reply(
        '⚖️ Спор открыт. Арбитр рассмотрит его в течение 24 часов.\n\n' +
        'До принятия решения средства остаются заморожены.',
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (err) {
      console.error('[Bot] handleMessage dispute error:', err.message);
      return ctx.reply('Ошибка открытия спора.');
    }
  }
}

module.exports = { handleMessage };
