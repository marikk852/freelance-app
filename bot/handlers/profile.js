const { User } = require('../../database/models');
const { query } = require('../../database/db');

// ============================================================
// Handler: User profile
// ============================================================

/**
 * Show the current user's profile.
 */
async function handleProfile(ctx) {
  try {
    const profile = await User.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Please run /start first');

    const levelBar  = buildXpBar(profile.xp, profile.level);
    const ratingStr = profile.rating > 0
      ? `${'⭐'.repeat(Math.round(profile.rating))} ${profile.rating}`
      : 'No reviews';

    const verifiedBadge = profile.is_verified ? ' ✅' : '';

    await ctx.reply(
      `👤 *${profile.first_name || profile.username}${verifiedBadge}*\n` +
      (profile.username ? `@${profile.username}\n` : '') +
      `\n` +
      `🏆 Level: *LVL ${profile.level}*\n` +
      `${levelBar}\n` +
      `⚡ XP: ${profile.xp}\n\n` +
      `📊 Stats:\n` +
      `• Deals completed: ${profile.deals_completed}\n` +
      `• Rating: ${ratingStr}\n` +
      `• 🔥 Streak: ${profile.streak_days} days\n` +
      `• 🪙 SafeCoins: ${profile.safe_coins}\n\n` +
      (profile.ton_wallet_address
        ? `💎 Wallet: \`${profile.ton_wallet_address.slice(0, 12)}...\``
        : `💎 No wallet linked\n/wallet <address>`),
      {
        parse_mode  : 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📁 Portfolio',    callback_data: 'portfolio' },
             { text: '⭐ Reviews',       callback_data: 'my_reviews' }],
            [{ text: '🌐 Open profile', web_app: { url: `${process.env.WEBAPP_URL}?screen=profile` } }],
          ],
        },
      }
    );
  } catch (err) {
    console.error('[Bot] handleProfile error:', err.message);
    await ctx.reply('Error loading profile.');
  }
}

/**
 * Save user's TON wallet.
 * /wallet UQ...
 */
async function handleSetWallet(ctx) {
  const parts   = ctx.message.text.split(' ');
  const address = parts[1]?.trim();

  if (!address) {
    return ctx.reply(
      '❌ Provide an address:\n`/wallet UQ...`',
      { parse_mode: 'Markdown' }
    );
  }

  // Basic TON address validation
  if (!/^(UQ|EQ)[A-Za-z0-9_\-]{46}$/.test(address)) {
    return ctx.reply('❌ Invalid TON address format. Example: `UQA...`', { parse_mode: 'Markdown' });
  }

  try {
    await User.setWallet(ctx.from.id, address);
    await ctx.reply(
      `✅ *Wallet linked!*\n\n\`${address}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[Bot] handleSetWallet error:', err.message);
    await ctx.reply('Error saving wallet.');
  }
}

/**
 * Render XP progress bar.
 */
function buildXpBar(xp, level) {
  const xpPerLevel = 200;
  const progress   = xp % xpPerLevel;
  const filled     = Math.round((progress / xpPerLevel) * 10);
  const bar        = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `[${bar}] ${progress}/${xpPerLevel}`;
}

module.exports = { handleProfile, handleSetWallet };
