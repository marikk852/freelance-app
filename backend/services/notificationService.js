const { query } = require('../../database/db');

// ============================================================
// Notification Service — sending Telegram notifications
// Agent 4: used by escrowService for notifications
// ============================================================

let _bot = null;

/**
 * Set bot instance for sending notifications.
 * Called during bot initialization.
 * @param {import('telegraf').Telegraf} bot
 */
function setBot(bot) {
  _bot = bot;
}

/**
 * Send a notification to a user via Telegram + save to DB.
 * @param {number} telegramId - user's Telegram ID
 * @param {string} type       - notification type
 * @param {string} message    - message text (Markdown)
 * @param {Object} payload    - additional data (for buttons)
 */
async function notify(telegramId, type, message, payload = {}) {
  // Save to DB
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
    console.error('[Notify] Error saving notification to DB:', err.message);
  }

  // Send via Telegram
  if (_bot) {
    try {
      await _bot.telegram.sendMessage(telegramId, message, {
        parse_mode : 'Markdown',
        reply_markup: payload.inlineKeyboard
          ? { inline_keyboard: payload.inlineKeyboard }
          : undefined,
      });
    } catch (err) {
      console.error(`[Notify] Error sending to Telegram (${telegramId}):`, err.message);
    }
  }
}

// ============================================================
// Pre-built notifications for key deal events
// ============================================================

/** Notify client that funds are frozen, freelancer — start working */
async function notifyEscrowFrozen({ clientTgId, freelancerTgId, contractTitle, contractId }) {
  await notify(
    clientTgId,
    'payment_received',
    `🔒 *Funds frozen*\n\nDeal: *${contractTitle}*\nThe freelancer is starting work. You will be notified when the work is submitted.`,
    { contractId }
  );
  await notify(
    freelancerTgId,
    'payment_received',
    `✅ *Payment received*\n\nDeal: *${contractTitle}*\nFunds are frozen in the smart contract. Start working! 🚀`,
    { contractId }
  );
}

/** Notify client that work has been submitted */
async function notifyWorkSubmitted({ clientTgId, contractTitle, contractId }) {
  await notify(
    clientTgId,
    'work_submitted',
    `📦 *Work submitted for review*\n\nDeal: *${contractTitle}*\nCheck the result and make a decision.`,
    {
      contractId,
      inlineKeyboard: [[
        { text: '🔍 Review', callback_data: `review_${contractId}` },
      ]],
    }
  );
}

/** Notify freelancer that work was approved */
async function notifyWorkApproved({ freelancerTgId, contractTitle, amount, currency }) {
  await notify(
    freelancerTgId,
    'work_approved',
    `🎉 *Work accepted!*\n\nDeal: *${contractTitle}*\n💰 *${amount} ${currency}* sent to your wallet.\n\n+200 XP awarded!`,
    {}
  );
}

/** Notify freelancer that work was rejected */
async function notifyWorkRejected({ freelancerTgId, contractTitle, comment }) {
  await notify(
    freelancerTgId,
    'work_rejected',
    `🔄 *Revisions needed*\n\nDeal: *${contractTitle}*\n\n📝 Client's comment:\n${comment}`,
    {}
  );
}

/** Notify both parties that a dispute was opened */
async function notifyDisputeOpened({ clientTgId, freelancerTgId, contractTitle, reason }) {
  const msg = `⚖️ *Dispute opened*\n\nDeal: *${contractTitle}*\nReason: ${reason}\n\nThe arbitrator will review the dispute within 24 hours.`;
  await notify(clientTgId,     'dispute_opened', msg, {});
  await notify(freelancerTgId, 'dispute_opened', msg, {});
}

/** Notify both parties of dispute resolution */
async function notifyDisputeResolved({ clientTgId, freelancerTgId, contractTitle, decision, splitPercent }) {
  let decisionText;
  if (decision === 'client_wins')     decisionText = '💙 Client receives full refund';
  else if (decision === 'freelancer_wins') decisionText = '💚 Freelancer receives full payment';
  else decisionText = `⚖️ Split: ${splitPercent}% to freelancer, ${100 - splitPercent}% to client`;

  const msg = `✅ *Dispute resolved*\n\nDeal: *${contractTitle}*\n${decisionText}`;
  await notify(clientTgId,     'dispute_resolved', msg, {});
  await notify(freelancerTgId, 'dispute_resolved', msg, {});
}

/** Reminder about approaching deadline (24 hours before) */
async function notifyDeadlineReminder({ freelancerTgId, contractTitle, hoursLeft }) {
  await notify(
    freelancerTgId,
    'deadline_reminder',
    `⏰ *Deadline in ${hoursLeft} hours*\n\nDeal: *${contractTitle}*\nDon't forget to submit your work on time!`,
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
