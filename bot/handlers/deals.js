const { query } = require('../../database/db');
const { Room, Contract, User } = require('../../database/models');
const escrowService = require('../../backend/services/escrowService');
const notificationService = require('../../backend/services/notificationService');
const { dealRoomClient, dealRoomFreelancer, currencyMenu, confirmMenu, openMiniApp } = require('../keyboards/inline');

// ============================================================
// Handler: Управление сделками
// ============================================================

/**
 * Показать список активных сделок пользователя.
 */
async function handleMyDeals(ctx) {
  try {
    const { rows: userRows } = await query(
      'SELECT id FROM users WHERE telegram_id = $1', [ctx.from.id]
    );
    if (!userRows[0]) return ctx.reply('Сначала нажми /start');

    const rooms = await Room.findActiveByUser(userRows[0].id);

    if (rooms.length === 0) {
      return ctx.reply(
        '📋 *Активных сделок нет*\n\nСоздай новую сделку или найди заказ на бирже.',
        {
          parse_mode  : 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚔️ Новая сделка',  callback_data: 'new_deal' }],
              [{ text: '📌 Биржа заказов', callback_data: 'job_board' }],
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
      const title  = r.contract_title || 'Без названия';
      const amount = r.amount_usd ? `$${r.amount_usd}` : '';
      return `${i + 1}. ${emoji} *${title}* ${amount}`;
    }).join('\n');

    const buttons = rooms.slice(0, 5).map(r => ([{
      text         : r.contract_title || `Сделка ${r.id.slice(0, 8)}`,
      callback_data: `deal_${r.id}`,
    }]));

    await ctx.reply(
      `📋 *Твои активные сделки:*\n\n${list}`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
    );
  } catch (err) {
    console.error('[Bot] handleMyDeals error:', err.message);
    await ctx.reply('Ошибка загрузки сделок.');
  }
}

/**
 * Показать комнату конкретной сделки.
 */
async function handleDealRoom(ctx, roomId) {
  try {
    const { rows: userRows } = await query(
      'SELECT id FROM users WHERE telegram_id = $1', [ctx.from.id]
    );
    if (!userRows[0]) return ctx.reply('Сначала нажми /start');

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

    if (!rows[0]) return ctx.reply('❌ Сделка не найдена.');

    const room     = rows[0];
    const isClient = room.client_id === userRows[0].id;
    const deadline = new Date(room.deadline).toLocaleDateString('ru-RU');

    const escrowStatusText = {
      waiting_payment: '⏳ Ожидает оплаты',
      frozen         : '🔒 Средства заморожены',
      released       : '✅ Выплачено',
      refunded       : '↩️ Возвращено',
    };

    const contractStatusText = {
      draft             : '📝 Черновик',
      pending_signature : '✍️ Ожидает подписи',
      signed            : '✅ Подписан',
      awaiting_payment  : '💳 Ожидает оплаты',
      in_progress       : '🔄 В работе',
      under_review      : '🔍 На проверке',
      completed         : '✅ Завершён',
      disputed          : '⚖️ Спор',
    };

    const msg =
      `🛡 *${room.title}*\n\n` +
      `📊 Статус: ${contractStatusText[room.contract_status] || room.contract_status}\n` +
      `💰 Сумма: *${room.amount_usd} USD* (${room.currency})\n` +
      `📅 Дедлайн: ${deadline}\n` +
      (room.escrow_status ? `🔐 Эскроу: ${escrowStatusText[room.escrow_status]}\n` : '') +
      (room.ton_contract_address
        ? `\n📍 Контракт: \`${room.ton_contract_address.slice(0, 20)}...\``
        : '');

    const keyboard = isClient
      ? dealRoomClient(room.contract_id)
      : dealRoomFreelancer(room.contract_id);

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch (err) {
    console.error('[Bot] handleDealRoom error:', err.message);
    await ctx.reply('Ошибка загрузки комнаты.');
  }
}

/**
 * Фрилансер принимает контракт.
 */
async function handleAcceptContract(ctx, roomId) {
  try {
    const { rows: userRows } = await query(
      'SELECT id, ton_wallet_address FROM users WHERE telegram_id = $1', [ctx.from.id]
    );
    if (!userRows[0]) return ctx.answerCbQuery('Сначала нажми /start');

    const user = userRows[0];

    // Присоединяем фрилансера к комнате
    const room = await Room.joinAsFreelancer(roomId, user.id);
    if (!room) {
      return ctx.answerCbQuery('❌ Не удалось присоединиться. Сделка уже занята.');
    }

    // Подписываем контракт за фрилансера
    const contract = await Contract.findByRoomId(roomId);
    await Contract.sign(contract.id, 'freelancer');

    await ctx.editMessageText(
      `✅ *Ты принял сделку!*\n\n` +
      `*${contract.title}*\n\n` +
      `Теперь клиент должен подтвердить и оплатить.\n` +
      `Ты получишь уведомление когда деньги будут заморожены.`,
      {
        parse_mode  : 'Markdown',
        reply_markup: openMiniApp('deal_room', contract.id),
      }
    );

    // Уведомляем клиента
    const { rows: clientRows } = await query(
      `SELECT u.telegram_id FROM users u
       JOIN rooms r ON r.client_id = u.id
       WHERE r.id = $1`, [roomId]
    );
    if (clientRows[0]) {
      await notificationService.notify(
        clientRows[0].telegram_id,
        'contract_signed',
        `✍️ *Фрилансер принял контракт!*\n\n` +
        `Сделка: *${contract.title}*\n\n` +
        `Теперь выбери валюту и задеплой смарт-контракт для оплаты.`,
        { contractId: contract.id }
      );
    }
  } catch (err) {
    console.error('[Bot] handleAcceptContract error:', err.message);
    await ctx.answerCbQuery('Произошла ошибка.');
  }
}

/**
 * Показать выбор валюты для оплаты.
 */
async function handlePayment(ctx, contractId) {
  try {
    const contract = await Contract.findById(contractId);
    if (!contract) return ctx.answerCbQuery('Контракт не найден');

    await ctx.reply(
      `💳 *Оплата сделки*\n\n` +
      `Сделка: *${contract.title}*\n` +
      `Сумма: *$${contract.amount_usd}*\n\n` +
      `Выбери валюту для оплаты:`,
      { parse_mode: 'Markdown', reply_markup: currencyMenu(contractId) }
    );
  } catch (err) {
    console.error('[Bot] handlePayment error:', err.message);
    await ctx.reply('Ошибка загрузки оплаты.');
  }
}

/**
 * Деплой смарт-контракта после выбора валюты.
 */
async function handleDeployCurrency(ctx, currency, contractId) {
  try {
    const { rows: userRows } = await query(
      'SELECT ton_wallet_address FROM users WHERE telegram_id = $1', [ctx.from.id]
    );

    const clientWallet = userRows[0]?.ton_wallet_address;
    if (!clientWallet) {
      return ctx.reply(
        '❌ *Кошелёк не привязан*\n\nУкажи TON адрес через /wallet <адрес>',
        { parse_mode: 'Markdown' }
      );
    }

    const contract = await Contract.findById(contractId);
    if (!contract) return ctx.answerCbQuery('Контракт не найден');

    // Получаем адрес фрилансера
    const { rows: freeRows } = await query(
      `SELECT u.ton_wallet_address FROM users u
       JOIN rooms r ON r.freelancer_id = u.id
       WHERE r.id = $1`, [contract.room_id]
    );

    const freelancerWallet = freeRows[0]?.ton_wallet_address;
    if (!freelancerWallet) {
      return ctx.reply('❌ У фрилансера не привязан TON кошелёк. Попроси его добавить через /wallet');
    }

    await ctx.reply('⏳ Деплоим смарт-контракт...');

    const result = await escrowService.deployContract({
      contractId       : contractId,
      clientAddress    : clientWallet,
      freelancerAddress: freelancerWallet,
      amountUsd        : Number(contract.amount_usd),
      currency,
      deadlineDate     : new Date(contract.deadline),
    });

    await ctx.reply(
      `✅ *Смарт-контракт готов!*\n\n` +
      `📍 Адрес: \`${result.tonContractAddress}\`\n` +
      `💰 Сумма: *${result.cryptoAmount.toFixed(4)} ${currency}*\n\n` +
      `Отправь точно эту сумму на адрес контракта через *@wallet* или *Tonkeeper*.\n\n` +
      `⚠️ Деньги заморозятся автоматически — бот уведомит обоих участников.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[Bot] handleDeployCurrency error:', err.message);
    await ctx.reply(`❌ Ошибка деплоя: ${err.message}`);
  }
}

module.exports = {
  handleMyDeals,
  handleDealRoom,
  handleAcceptContract,
  handlePayment,
  handleDeployCurrency,
};
