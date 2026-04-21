const { handleMyDeals, handleDealRoom, handleAcceptContract, handleDeployCurrency } = require('./deals');
const { handleProfile } = require('./profile');
const { query } = require('../../database/db');
const escrowService = require('../../backend/services/escrowService');
const notificationService = require('../../backend/services/notificationService');
const { openMiniApp, confirmMenu } = require('../keyboards/inline');

// ============================================================
// Callback Query Router — all inline button presses
// ============================================================

/**
 * Main callback_data router.
 * Parse prefix_payload and call the appropriate handler.
 */
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;

  try {
    // ---- Навигация ----
    if (data === 'my_deals')    return handleMyDeals(ctx);
    if (data === 'profile')     return handleProfile(ctx);
    if (data === 'new_deal')    return handleNewDeal(ctx);
    if (data === 'job_board')   return handleJobBoard(ctx);
    if (data === 'cancel_action') return ctx.answerCbQuery('Cancelled');

    // ---- Deal room ----
    if (data.startsWith('deal_')) {
      await ctx.answerCbQuery();
      return handleDealRoom(ctx, data.replace('deal_', ''));
    }

    // ---- Accept/decline contract ----
    if (data.startsWith('accept_contract_')) {
      await ctx.answerCbQuery('⏳ Processing...');
      return handleAcceptContract(ctx, data.replace('accept_contract_', ''));
    }
    if (data.startsWith('decline_contract_')) {
      await ctx.answerCbQuery('Declined');
      return ctx.editMessageText('❌ You declined this proposal.');
    }

    // ---- Payment currency ----
    if (data.startsWith('pay_ton_')) {
      await ctx.answerCbQuery('💎 TON selected');
      return handleDeployCurrency(ctx, 'TON', data.replace('pay_ton_', ''));
    }
    if (data.startsWith('pay_usdt_')) {
      await ctx.answerCbQuery('💵 USDT selected');
      return handleDeployCurrency(ctx, 'USDT', data.replace('pay_usdt_', ''));
    }

    // ---- Work review ----
    if (data.startsWith('review_')) {
      await ctx.answerCbQuery();
      return handleReview(ctx, data.replace('review_', ''));
    }

    // ---- Approve work ----
    if (data.startsWith('approve_')) {
      await ctx.answerCbQuery('⏳ Confirming...');
      return handleApproveDelivery(ctx, data.replace('approve_', ''));
    }

    // ---- Reject work ----
    if (data.startsWith('reject_')) {
      await ctx.answerCbQuery();
      return handleRejectDelivery(ctx, data.replace('reject_', ''));
    }

    // ---- Dispute ----
    if (data.startsWith('dispute_')) {
      await ctx.answerCbQuery();
      return handleOpenDispute(ctx, data.replace('dispute_', ''));
    }

    // ---- Confirmations ----
    if (data.startsWith('confirm_')) {
      await ctx.answerCbQuery();
      return handleConfirm(ctx, data.replace('confirm_', ''));
    }

    await ctx.answerCbQuery('Unknown action');
  } catch (err) {
    console.error('[Bot] handleCallback error:', err.message, '| data:', data);
    await ctx.answerCbQuery('An error occurred').catch(() => {});
  }
}

/**
 * Invite freelancer — show link.
 */
async function handleNewDeal(ctx) {
  await ctx.reply(
    `⚔️ *New deal*\n\n` +
    `Use the Mini App to create a deal — it's easier to fill in all the details there:\n` +
    `title, description, amount, deadline and acceptance criteria.`,
    {
      parse_mode  : 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text   : '✍️ Create deal',
          web_app: { url: `${process.env.WEBAPP_URL}?screen=new_deal` },
        }]],
      },
    }
  );
}

/**
 * Job board — open Mini App.
 */
async function handleJobBoard(ctx) {
  await ctx.reply(
    '📌 *Job board*\n\nOpen the app to browse jobs:',
    {
      parse_mode  : 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text   : '🔍 Open job board',
          web_app: { url: `${process.env.WEBAPP_URL}?screen=job_board` },
        }]],
      },
    }
  );
}

/**
 * Client reviews submitted work.
 */
async function handleReview(ctx, contractId) {
  const { rows } = await query(
    `SELECT d.id, d.files, d.description, d.submitted_at, d.attempt_number
     FROM deliveries d
     WHERE d.contract_id = $1 AND d.status = 'submitted'
     ORDER BY d.submitted_at DESC LIMIT 1`,
    [contractId]
  );

  if (!rows[0]) {
    return ctx.reply('📭 Work has not been submitted yet.');
  }

  const delivery = rows[0];
  const files    = typeof delivery.files === 'string'
    ? JSON.parse(delivery.files) : delivery.files;

  const fileList = files.map((f, i) =>
    `${i + 1}. [${f.originalName}](/api/deliveries/preview/${f.fileId})`
  ).join('\n');

  await ctx.reply(
    `🔍 *Work review* (attempt ${delivery.attempt_number})\n\n` +
    (delivery.description ? `📝 ${delivery.description}\n\n` : '') +
    `📎 Files:\n${fileList}\n\n` +
    `Previews are available via the links above. Originals — after acceptance.`,
    {
      parse_mode  : 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Accept work',   callback_data: `approve_${delivery.id}` }],
          [{ text: '🔄 Needs revision', callback_data: `reject_${delivery.id}` }],
          [{ text: '⚖️ Open dispute',  callback_data: `dispute_${contractId}` }],
          [{
            text   : '🔍 View in app',
            web_app: { url: `${process.env.WEBAPP_URL}?screen=review&id=${contractId}` },
          }],
        ],
      },
    }
  );
}

/**
 * Client approves work → release escrow.
 */
async function handleApproveDelivery(ctx, deliveryId) {
  const { rows } = await query(
    `SELECT d.contract_id, c.title,
            uf.telegram_id AS freelancer_tg_id,
            c.crypto_amount, c.currency
     FROM deliveries d
     JOIN contracts c ON c.id = d.contract_id
     JOIN rooms r ON r.id = c.room_id
     JOIN users uf ON uf.id = r.freelancer_id
     WHERE d.id = $1`,
    [deliveryId]
  );
  if (!rows[0]) return ctx.reply('❌ Delivery not found.');

  const rec = rows[0];

  // Confirmation before release
  await ctx.editMessageText(
    `⚠️ *Confirm work acceptance*\n\n` +
    `Deal: *${rec.title}*\n` +
    `Upon confirmation *${rec.crypto_amount} ${rec.currency}* will be sent to the freelancer.\n\n` +
    `This action is irreversible!`,
    {
      parse_mode  : 'Markdown',
      reply_markup: confirmMenu('approve', deliveryId),
    }
  );
}

/**
 * Final confirmation — execute action.
 */
async function handleConfirm(ctx, actionAndId) {
  const [action, id] = actionAndId.split('_');

  if (action === 'approve') {
    try {
      const { rows } = await query(
        `SELECT d.contract_id, c.title,
                uf.telegram_id AS freelancer_tg_id,
                c.crypto_amount, c.currency
         FROM deliveries d
         JOIN contracts c ON c.id = d.contract_id
         JOIN rooms r ON r.id = c.room_id
         JOIN users uf ON uf.id = r.freelancer_id
         WHERE d.id = $1`, [id]
      );

      // Mark delivery as approved
      await query(
        `UPDATE deliveries SET status = 'approved', reviewed_at = NOW() WHERE id = $1`, [id]
      );

      // Trigger release
      const txHash = await escrowService.releaseEscrow(rows[0].contract_id, ctx.from.id);

      await notificationService.notifyWorkApproved({
        freelancerTgId: rows[0].freelancer_tg_id,
        contractTitle : rows[0].title,
        amount        : rows[0].crypto_amount,
        currency      : rows[0].currency,
      });

      await ctx.editMessageText(
        `🎉 *Work accepted!*\n\n` +
        `*${rows[0].crypto_amount} ${rows[0].currency}* sent to the freelancer.\n` +
        `TX: \`${txHash.slice(0, 20)}...\`\n\n` +
        `+200 XP awarded! Don't forget to leave a review.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[Bot] handleConfirm approve error:', err.message);
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }
}

/**
 * Client rejects work — request a comment.
 */
async function handleRejectDelivery(ctx, deliveryId) {
  // Save deliveryId in session for the next step
  ctx.session = ctx.session || {};
  ctx.session.pendingReject = deliveryId;

  await ctx.reply(
    '✏️ Write a comment with revision requests:',
    { reply_markup: { force_reply: true } }
  );
}

/**
 * Open a dispute for a contract.
 */
async function handleOpenDispute(ctx, contractId) {
  ctx.session = ctx.session || {};
  ctx.session.pendingDispute = contractId;

  await ctx.reply(
    '⚖️ *Opening a dispute*\n\nDescribe the reason for the dispute:',
    { parse_mode: 'Markdown', reply_markup: { force_reply: true } }
  );
}

module.exports = { handleCallback };
