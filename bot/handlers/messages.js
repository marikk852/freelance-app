const { query } = require('../../database/db');
const notificationService = require('../../backend/services/notificationService');

// ============================================================
// Handler: Text messages (force_reply responses)
// ============================================================

/**
 * Incoming text message handler.
 * Used for multi-step flows (reject comment, dispute).
 */
async function handleMessage(ctx) {
  const session = ctx.session || {};
  const text    = ctx.message?.text;

  if (!text) return;

  // ---- Reply with comment for reject delivery ----
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
      if (!rows[0]) return ctx.reply('❌ Delivery not found');

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
        '✅ Comment sent to the freelancer. Waiting for revisions.',
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (err) {
      console.error('[Bot] handleMessage reject error:', err.message);
      return ctx.reply('Error rejecting work.');
    }
  }

  // ---- Dispute reason ----
  if (session.pendingDispute) {
    const contractId = session.pendingDispute;
    delete ctx.session.pendingDispute;

    try {
      const { rows: userRows } = await query(
        'SELECT id FROM users WHERE telegram_id = $1', [ctx.from.id]
      );
      if (!userRows[0]) return ctx.reply('Error: user not found.');

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

      // Notify both parties
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
        '⚖️ Dispute opened. The arbitrator will review it within 24 hours.\n\n' +
        'Funds remain frozen until a decision is made.',
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (err) {
      console.error('[Bot] handleMessage dispute error:', err.message);
      return ctx.reply('Error opening dispute.');
    }
  }
}

module.exports = { handleMessage };
