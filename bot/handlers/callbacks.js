const { handleMyDeals, handleDealRoom, handleAcceptContract, handleDeployCurrency } = require('./deals');
const { handleProfile } = require('./profile');
const { query } = require('../../database/db');
const escrowService = require('../../backend/services/escrowService');
const notificationService = require('../../backend/services/notificationService');
const { openMiniApp, confirmMenu } = require('../keyboards/inline');

// ============================================================
// Callback Query Router — все нажатия inline-кнопок
// ============================================================

/**
 * Главный роутер callback_data.
 * Парсим prefix_payload и вызываем нужный обработчик.
 */
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;

  try {
    // ---- Навигация ----
    if (data === 'my_deals')    return handleMyDeals(ctx);
    if (data === 'profile')     return handleProfile(ctx);
    if (data === 'new_deal')    return handleNewDeal(ctx);
    if (data === 'job_board')   return handleJobBoard(ctx);
    if (data === 'cancel_action') return ctx.answerCbQuery('Отменено');

    // ---- Комната сделки ----
    if (data.startsWith('deal_')) {
      await ctx.answerCbQuery();
      return handleDealRoom(ctx, data.replace('deal_', ''));
    }

    // ---- Принять/отклонить контракт ----
    if (data.startsWith('accept_contract_')) {
      await ctx.answerCbQuery('⏳ Обрабатываем...');
      return handleAcceptContract(ctx, data.replace('accept_contract_', ''));
    }
    if (data.startsWith('decline_contract_')) {
      await ctx.answerCbQuery('Отклонено');
      return ctx.editMessageText('❌ Ты отклонил это предложение.');
    }

    // ---- Валюта оплаты ----
    if (data.startsWith('pay_ton_')) {
      await ctx.answerCbQuery('💎 TON выбран');
      return handleDeployCurrency(ctx, 'TON', data.replace('pay_ton_', ''));
    }
    if (data.startsWith('pay_usdt_')) {
      await ctx.answerCbQuery('💵 USDT выбран');
      return handleDeployCurrency(ctx, 'USDT', data.replace('pay_usdt_', ''));
    }

    // ---- Проверка работы ----
    if (data.startsWith('review_')) {
      await ctx.answerCbQuery();
      return handleReview(ctx, data.replace('review_', ''));
    }

    // ---- Одобрение работы ----
    if (data.startsWith('approve_')) {
      await ctx.answerCbQuery('⏳ Подтверждаем...');
      return handleApproveDelivery(ctx, data.replace('approve_', ''));
    }

    // ---- Отклонение работы ----
    if (data.startsWith('reject_')) {
      await ctx.answerCbQuery();
      return handleRejectDelivery(ctx, data.replace('reject_', ''));
    }

    // ---- Спор ----
    if (data.startsWith('dispute_')) {
      await ctx.answerCbQuery();
      return handleOpenDispute(ctx, data.replace('dispute_', ''));
    }

    // ---- Подтверждения ----
    if (data.startsWith('confirm_')) {
      await ctx.answerCbQuery();
      return handleConfirm(ctx, data.replace('confirm_', ''));
    }

    await ctx.answerCbQuery('Неизвестное действие');
  } catch (err) {
    console.error('[Bot] handleCallback error:', err.message, '| data:', data);
    await ctx.answerCbQuery('Произошла ошибка').catch(() => {});
  }
}

/**
 * Пригласить фрилансера — показываем ссылку.
 */
async function handleNewDeal(ctx) {
  await ctx.reply(
    `⚔️ *Новая сделка*\n\n` +
    `Для создания сделки используй Mini App — там удобнее заполнить все детали:\n` +
    `название, описание, сумму, дедлайн и критерии приёмки.`,
    {
      parse_mode  : 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text   : '✍️ Создать сделку',
          web_app: { url: `${process.env.WEBAPP_URL}?screen=new_deal` },
        }]],
      },
    }
  );
}

/**
 * Биржа заказов — открываем Mini App.
 */
async function handleJobBoard(ctx) {
  await ctx.reply(
    '📌 *Биржа заказов*\n\nОткрой приложение для просмотра заказов:',
    {
      parse_mode  : 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text   : '🔍 Открыть биржу',
          web_app: { url: `${process.env.WEBAPP_URL}?screen=job_board` },
        }]],
      },
    }
  );
}

/**
 * Клиент проверяет сданную работу.
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
    return ctx.reply('📭 Работа ещё не сдана.');
  }

  const delivery = rows[0];
  const files    = typeof delivery.files === 'string'
    ? JSON.parse(delivery.files) : delivery.files;

  const fileList = files.map((f, i) =>
    `${i + 1}. [${f.originalName}](/api/deliveries/preview/${f.fileId})`
  ).join('\n');

  await ctx.reply(
    `🔍 *Проверка работы* (попытка ${delivery.attempt_number})\n\n` +
    (delivery.description ? `📝 ${delivery.description}\n\n` : '') +
    `📎 Файлы:\n${fileList}\n\n` +
    `Превью доступны по ссылкам выше. Оригиналы — после принятия.`,
    {
      parse_mode  : 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Принять работу',  callback_data: `approve_${delivery.id}` }],
          [{ text: '🔄 Нужны правки',   callback_data: `reject_${delivery.id}` }],
          [{ text: '⚖️ Открыть спор',  callback_data: `dispute_${contractId}` }],
          [{
            text   : '🔍 Смотреть в приложении',
            web_app: { url: `${process.env.WEBAPP_URL}?screen=review&id=${contractId}` },
          }],
        ],
      },
    }
  );
}

/**
 * Клиент принимает работу → release эскроу.
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
  if (!rows[0]) return ctx.reply('❌ Delivery не найден.');

  const rec = rows[0];

  // Подтверждение перед release
  await ctx.editMessageText(
    `⚠️ *Подтверди принятие работы*\n\n` +
    `Сделка: *${rec.title}*\n` +
    `После подтверждения *${rec.crypto_amount} ${rec.currency}* будет отправлено фрилансеру.\n\n` +
    `Это действие необратимо!`,
    {
      parse_mode  : 'Markdown',
      reply_markup: confirmMenu('approve', deliveryId),
    }
  );
}

/**
 * Финальное подтверждение — выполняем действие.
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

      // Помечаем delivery как approved
      await query(
        `UPDATE deliveries SET status = 'approved', reviewed_at = NOW() WHERE id = $1`, [id]
      );

      // Триггерим release
      const txHash = await escrowService.releaseEscrow(rows[0].contract_id, ctx.from.id);

      await notificationService.notifyWorkApproved({
        freelancerTgId: rows[0].freelancer_tg_id,
        contractTitle : rows[0].title,
        amount        : rows[0].crypto_amount,
        currency      : rows[0].currency,
      });

      await ctx.editMessageText(
        `🎉 *Работа принята!*\n\n` +
        `*${rows[0].crypto_amount} ${rows[0].currency}* отправлено фрилансеру.\n` +
        `TX: \`${txHash.slice(0, 20)}...\`\n\n` +
        `+200 XP начислено! Не забудь оставить отзыв.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[Bot] handleConfirm approve error:', err.message);
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  }
}

/**
 * Клиент отклоняет работу — запрашиваем комментарий.
 */
async function handleRejectDelivery(ctx, deliveryId) {
  // Сохраняем deliveryId в session для следующего шага
  ctx.session = ctx.session || {};
  ctx.session.pendingReject = deliveryId;

  await ctx.reply(
    '✏️ Напиши комментарий с пожеланиями по правкам:',
    { reply_markup: { force_reply: true } }
  );
}

/**
 * Открыть спор по контракту.
 */
async function handleOpenDispute(ctx, contractId) {
  ctx.session = ctx.session || {};
  ctx.session.pendingDispute = contractId;

  await ctx.reply(
    '⚖️ *Открытие спора*\n\nОпиши причину спора:',
    { parse_mode: 'Markdown', reply_markup: { force_reply: true } }
  );
}

module.exports = { handleCallback };
