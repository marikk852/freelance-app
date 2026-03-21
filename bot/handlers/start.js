const { User } = require('../../database/models');
const { mainMenu } = require('../keyboards/inline');

// ============================================================
// Handler: /start
// Регистрация/обновление пользователя + главное меню
// ============================================================

/**
 * Обработать /start.
 * Если передан параметр (start=room_XXXX) — открыть комнату.
 */
async function handleStart(ctx) {
  const tg   = ctx.from;
  const args = ctx.message?.text?.split(' ')[1]; // параметр после /start

  try {
    // Upsert пользователя в БД
    const user = await User.upsert({
      telegram_id: tg.id,
      username   : tg.username,
      first_name : tg.first_name,
      last_name  : tg.last_name,
    });

    // Обновляем streak и начисляем XP за ежедневный вход
    await User.updateStreak(user.id);
    await User.addXp(user.id, 10);

    // Если это приглашение в комнату (фрилансер переходит по invite_link)
    if (args && args.startsWith('room_')) {
      const inviteLink = args.replace('room_', '');
      return handleRoomInvite(ctx, user, inviteLink);
    }

    // Обычный /start — показываем главное меню
    const levelInfo = `LVL ${user.level} · ${user.xp} XP`;
    const greeting  = user.deals_completed > 0
      ? `С возвращением, *${tg.first_name}*!`
      : `Добро пожаловать в *SafeDeal*, *${tg.first_name}*!`;

    await ctx.reply(
      `${greeting}\n\n` +
      `🛡 Безопасные сделки на блокчейне TON\n\n` +
      `📊 Твой статус: ${levelInfo}\n` +
      `🔥 Streak: ${user.streak_days} дней\n` +
      `🏅 Рейтинг: ${user.rating > 0 ? `⭐ ${user.rating}` : 'нет отзывов'}\n\n` +
      `Выбери действие:`,
      {
        parse_mode  : 'Markdown',
        reply_markup: mainMenu(),
      }
    );
  } catch (err) {
    console.error('[Bot] handleStart error:', err.message);
    await ctx.reply('Произошла ошибка. Попробуй позже.');
  }
}

/**
 * Фрилансер перешёл по invite_link — показываем контракт.
 */
async function handleRoomInvite(ctx, user, inviteLink) {
  const { Room, Contract } = require('../../database/models');
  const { acceptContractMenu } = require('../keyboards/inline');
  const { query } = require('../../database/db');

  try {
    const room = await Room.findByInviteLink(inviteLink);
    if (!room) {
      return ctx.reply('❌ Ссылка недействительна или сделка уже закрыта.');
    }

    if (room.client_id === user.id) {
      return ctx.reply('❌ Нельзя принять собственную сделку.');
    }

    if (room.status !== 'waiting') {
      return ctx.reply('❌ Эта сделка уже началась или завершена.');
    }

    // Получаем контракт
    const contract = await Contract.findByRoomId(room.id);
    if (!contract) {
      return ctx.reply('❌ Контракт не найден.');
    }

    const deadline = new Date(contract.deadline).toLocaleDateString('ru-RU');
    const criteria = contract.criteria.map((c, i) => `${i + 1}. ${c.text}`).join('\n');

    await ctx.reply(
      `📋 *Предложение о сделке*\n\n` +
      `*${contract.title}*\n\n` +
      `📝 ${contract.description}\n\n` +
      `💰 Сумма: *${contract.amount_usd} USD* (${contract.currency})\n` +
      `📅 Дедлайн: *${deadline}*\n\n` +
      `✅ Критерии приёмки:\n${criteria}\n\n` +
      `Принять эту сделку?`,
      {
        parse_mode  : 'Markdown',
        reply_markup: acceptContractMenu(room.id),
      }
    );
  } catch (err) {
    console.error('[Bot] handleRoomInvite error:', err.message);
    await ctx.reply('Произошла ошибка при загрузке сделки.');
  }
}

module.exports = { handleStart, handleRoomInvite };
