const { User } = require('../../database/models');
const { query } = require('../../database/db');

// ============================================================
// Handler: Профиль пользователя
// ============================================================

/**
 * Показать профиль текущего пользователя.
 */
async function handleProfile(ctx) {
  try {
    const profile = await User.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Сначала нажми /start');

    const levelBar  = buildXpBar(profile.xp, profile.level);
    const ratingStr = profile.rating > 0
      ? `${'⭐'.repeat(Math.round(profile.rating))} ${profile.rating}`
      : 'Нет отзывов';

    const verifiedBadge = profile.is_verified ? ' ✅' : '';

    await ctx.reply(
      `👤 *${profile.first_name || profile.username}${verifiedBadge}*\n` +
      (profile.username ? `@${profile.username}\n` : '') +
      `\n` +
      `🏆 Уровень: *LVL ${profile.level}*\n` +
      `${levelBar}\n` +
      `⚡ XP: ${profile.xp}\n\n` +
      `📊 Статистика:\n` +
      `• Сделок завершено: ${profile.deals_completed}\n` +
      `• Рейтинг: ${ratingStr}\n` +
      `• 🔥 Streak: ${profile.streak_days} дней\n` +
      `• 🪙 SafeCoins: ${profile.safe_coins}\n\n` +
      (profile.ton_wallet_address
        ? `💎 Кошелёк: \`${profile.ton_wallet_address.slice(0, 12)}...\``
        : `💎 Кошелёк не привязан\n/wallet <адрес>`),
      {
        parse_mode  : 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📁 Портфолио',    callback_data: 'portfolio' },
             { text: '⭐ Отзывы',        callback_data: 'my_reviews' }],
            [{ text: '🌐 Открыть профиль', web_app: { url: `${process.env.WEBAPP_URL}?screen=profile` } }],
          ],
        },
      }
    );
  } catch (err) {
    console.error('[Bot] handleProfile error:', err.message);
    await ctx.reply('Ошибка загрузки профиля.');
  }
}

/**
 * Сохранить TON кошелёк пользователя.
 * /wallet UQ...
 */
async function handleSetWallet(ctx) {
  const parts   = ctx.message.text.split(' ');
  const address = parts[1]?.trim();

  if (!address) {
    return ctx.reply(
      '❌ Укажи адрес:\n`/wallet UQ...`',
      { parse_mode: 'Markdown' }
    );
  }

  // Базовая проверка TON адреса
  if (!/^(UQ|EQ)[A-Za-z0-9_\-]{46}$/.test(address)) {
    return ctx.reply('❌ Неверный формат TON адреса. Пример: `UQA...`', { parse_mode: 'Markdown' });
  }

  try {
    await User.setWallet(ctx.from.id, address);
    await ctx.reply(
      `✅ *Кошелёк привязан!*\n\n\`${address}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[Bot] handleSetWallet error:', err.message);
    await ctx.reply('Ошибка сохранения кошелька.');
  }
}

/**
 * Отобразить прогресс-бар XP.
 */
function buildXpBar(xp, level) {
  const xpPerLevel = 200;
  const progress   = xp % xpPerLevel;
  const filled     = Math.round((progress / xpPerLevel) * 10);
  const bar        = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `[${bar}] ${progress}/${xpPerLevel}`;
}

module.exports = { handleProfile, handleSetWallet };
