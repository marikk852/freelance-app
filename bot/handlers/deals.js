const { query } = require('../../database/db');
const { Room, Contract, User } = require('../../database/models');
const escrowService = require('../../backend/services/escrowService');
const notificationService = require('../../backend/services/notificationService');
const { dealRoomClient, dealRoomFreelancer, currencyMenu, confirmMenu, openMiniApp } = require('../keyboards/inline');

// ============================================================
// Handler: Deal management
// ============================================================

/**
 * Show a list of the user's active deals.
 */
async function handleMyDeals(ctx) {
  try {
    const { rows: userRows } = await query(
      'SELECT id FROM users WHERE telegram_id = $1', [ctx.from.id]
    );
    if (!userRows[0]) return ctx.reply('Please run /start first');

    const rooms = await Room.findActiveByUser(userRows[0].id);

    if (rooms.length === 0) {
      return ctx.reply(
        '📋 *No active deals*\n\nCreate a new deal or find a job on the board.',
        {
          parse_mode  : 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚔️ New deal',    callback_data: 'new_deal' }],
              [{ text: '📌 Job board',   callback_data: 'job_board' }],
            ],
          },
        }
      );
    }

    const statusEmoji = {
      waiting    : '⏳', active: '🔄', completed: '✅',
      disputed   : '⚖️', cancelled: '❌',
    };

    const list = rooms.map((r, i) => {
      const emoji  = statusEmoji[r.status] || '🔄';
      const title  = r.contract_title || 'Untitled';
      const amount = r.amount_usd ? `$${r.amount_usd}` : '';
      return `${i + 1}. ${emoji} *${title}* ${amount}`;
    }).join('\n');

    const buttons = rooms.slice(0, 5).map(r => ([{
      text         : r.contract_title || `Deal ${r.id.slice(0, 8)}`,
      callback_data: `deal_${r.id}`,
    }]));

    await ctx.reply(
      `📋 *Your active deals:*\n\n${list}`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
    );
  } catch (err) {
    console.error('[Bot] handleMyDeals error:', err.message);
    await ctx.reply('Error loading deals.');
  }
}

/**
 * Show the room for a specific deal.
 */
async function handleDealRoom(ctx, roomId) {
  try {
    const { rows: userRows } = await query(
      'SELECT id FROM users WHERE telegram_id = $1', [ctx.from.id]
    );
    if (!userRows[0]) return ctx.reply('Please run /start first');

    const { rows } = await query(
      `SELECT r.*, c.title, c.description, c.amount_usd, c.currency,
              c.status AS contract_status, c.id AS contract_id,
              c.deadline, c.ton_contract_address,
              e.status AS escrow_status, e.amount AS escrow_amount
       FROM rooms r
       LEFT JOIN contracts c ON c.room_id = r.id
       LEFT JOIN escrow e ON e.contract_id = c.id
       WHERE r.id = $1`,
      [roomId]
    );

    if (!rows[0]) return ctx.reply('❌ Deal not found.');

    const room     = rows[0];
    const isClient = room.client_id === userRows[0].id;
    const deadline = new Date(room.deadline).toLocaleDateString('en-US');

    const escrowStatusText = {
      waiting_payment: '⏳ Awaiting payment',
      frozen         : '🔒 Funds frozen',
      released       : '✅ Paid out',
      refunded       : '↩️ Refunded',
    };

    const contractStatusText = {
      draft             : '📝 Draft',
      pending_signature : '✍️ Awaiting signature',
      signed            : '✅ Signed',
      awaiting_payment  : '💳 Awaiting payment',
      in_progress       : '🔄 In progress',
      under_review      : '🔍 Under review',
      completed         : '✅ Completed',
      disputed          : '⚖️ Dispute',
    };

    const msg =
      `🛡 *${room.title}*\n\n` +
      `📊 Status: ${contractStatusText[room.contract_status] || room.contract_status}\n` +
      `💰 Amount: *${room.amount_usd} USD* (${room.currency})\n` +
      `📅 Deadline: ${deadline}\n` +
      (room.escrow_status ? `🔐 Escrow: ${escrowStatusText[room.escrow_status]}\n` : '') +
      (room.ton_contract_address
        ? `\n📍 Contract: \`${room.ton_contract_address.slice(0, 20)}...\``
        : '');

    const keyboard = isClient
      ? dealRoomClient(room.contract_id)
      : dealRoomFreelancer(room.contract_id);

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch (err) {
    console.error('[Bot] handleDealRoom error:', err.message);
    await ctx.reply('Error loading room.');
  }
}

/**
 * Freelancer accepts the contract.
 */
async function handleAcceptContract(ctx, roomId) {
  try {
    const { rows: userRows } = await query(
      'SELECT id, ton_wallet_address FROM users WHERE telegram_id = $1', [ctx.from.id]
    );
    if (!userRows[0]) return ctx.answerCbQuery('Please run /start first');

    const user = userRows[0];

    // Attach freelancer to the room
    const room = await Room.joinAsFreelancer(roomId, user.id);
    if (!room) {
      return ctx.answerCbQuery('❌ Could not join. Deal is already taken.');
    }

    // Sign contract as freelancer
    const contract = await Contract.findByRoomId(roomId);
    await Contract.sign(contract.id, 'freelancer');

    await ctx.editMessageText(
      `✅ *You accepted the deal!*\n\n` +
      `*${contract.title}*\n\n` +
      `The client must now confirm and pay.\n` +
      `You will receive a notification once funds are frozen.`,
      {
        parse_mode  : 'Markdown',
        reply_markup: openMiniApp('deal_room', contract.id),
      }
    );

    // Notify the client
    const { rows: clientRows } = await query(
      `SELECT u.telegram_id FROM users u
       JOIN rooms r ON r.client_id = u.id
       WHERE r.id = $1`, [roomId]
    );
    if (clientRows[0]) {
      await notificationService.notify(
        clientRows[0].telegram_id,
        'contract_signed',
        `✍️ *Freelancer accepted the contract!*\n\n` +
        `Deal: *${contract.title}*\n\n` +
        `Now select the currency and deploy the smart contract for payment.`,
        { contractId: contract.id }
      );
    }
  } catch (err) {
    console.error('[Bot] handleAcceptContract error:', err.message);
    await ctx.answerCbQuery('An error occurred.');
  }
}

/**
 * Show currency selection for payment.
 */
async function handlePayment(ctx, contractId) {
  try {
    const contract = await Contract.findById(contractId);
    if (!contract) return ctx.answerCbQuery('Contract not found');

    await ctx.reply(
      `💳 *Deal payment*\n\n` +
      `Deal: *${contract.title}*\n` +
      `Amount: *$${contract.amount_usd}*\n\n` +
      `Select payment currency:`,
      { parse_mode: 'Markdown', reply_markup: currencyMenu(contractId) }
    );
  } catch (err) {
    console.error('[Bot] handlePayment error:', err.message);
    await ctx.reply('Error loading payment.');
  }
}

/**
 * Deploy smart contract after selecting currency.
 */
async function handleDeployCurrency(ctx, currency, contractId) {
  try {
    const { rows: userRows } = await query(
      'SELECT ton_wallet_address FROM users WHERE telegram_id = $1', [ctx.from.id]
    );

    const clientWallet = userRows[0]?.ton_wallet_address;
    if (!clientWallet) {
      return ctx.reply(
        '❌ *Wallet not linked*\n\nProvide your TON address via /wallet <address>',
        { parse_mode: 'Markdown' }
      );
    }

    const contract = await Contract.findById(contractId);
    if (!contract) return ctx.answerCbQuery('Contract not found');

    // Get freelancer address
    const { rows: freeRows } = await query(
      `SELECT u.ton_wallet_address FROM users u
       JOIN rooms r ON r.freelancer_id = u.id
       WHERE r.id = $1`, [contract.room_id]
    );

    const freelancerWallet = freeRows[0]?.ton_wallet_address;
    if (!freelancerWallet) {
      return ctx.reply('❌ The freelancer has no TON wallet linked. Ask them to add one via /wallet');
    }

    await ctx.reply('⏳ Deploying smart contract...');

    const result = await escrowService.deployContract({
      contractId       : contractId,
      clientAddress    : clientWallet,
      freelancerAddress: freelancerWallet,
      amountUsd        : Number(contract.amount_usd),
      currency,
      deadlineDate     : new Date(contract.deadline),
    });

    await ctx.reply(
      `✅ *Smart contract is ready!*\n\n` +
      `📍 Address: \`${result.tonContractAddress}\`\n` +
      `💰 Amount: *${result.cryptoAmount.toFixed(4)} ${currency}*\n\n` +
      `Send exactly this amount to the contract address via *@wallet* or *Tonkeeper*.\n\n` +
      `⚠️ Funds will freeze automatically — the bot will notify both participants.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[Bot] handleDeployCurrency error:', err.message);
    await ctx.reply(`❌ Deploy error: ${err.message}`);
  }
}

module.exports = {
  handleMyDeals,
  handleDealRoom,
  handleAcceptContract,
  handlePayment,
  handleDeployCurrency,
};
