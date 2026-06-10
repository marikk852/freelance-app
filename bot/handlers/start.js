const { User } = require('../../database/models');
const { mainMenu } = require('../keyboards/inline');

// ============================================================
// Handler: /start
// User registration/update + main menu
// ============================================================

/**
 * Handle /start.
 * If a parameter is passed (start=room_XXXX) — open the room.
 */
async function handleStart(ctx) {
  const tg   = ctx.from;
  const args = ctx.message?.text?.split(' ')[1]; // parameter after /start

  try {
    let user;

    // Handle referral registration: ref_<referrer_telegram_id>
    if (args && args.startsWith('ref_')) {
      const referrerTelegramId = parseInt(args.replace('ref_', ''), 10);

      if (referrerTelegramId && referrerTelegramId !== tg.id) {
        const { newUser, referrer, isNew } = await User.registerWithReferral({
          telegram_id         : tg.id,
          username            : tg.username,
          first_name          : tg.first_name,
          last_name           : tg.last_name,
          referrer_telegram_id: referrerTelegramId,
        });
        user = newUser;

        // Notify the new user they joined via referral
        if (isNew) {
          await ctx.reply(
            `👋 *Welcome to SafeDeal!*\n\n` +
            `You joined via a referral link.\n` +
            `🪙 Your friend earned *50 SafeCoins* for inviting you!\n\n` +
            `Complete deals to earn your own coins and level up.`,
            { parse_mode: 'Markdown' }
          );

          // Notify the referrer (fire and forget)
          if (referrer) {
            const milestoneMsg = referrer.referral_count % 5 === 0
              ? `\n\n🎉 *Milestone bonus!* +100 extra SafeCoins for ${referrer.referral_count} referrals!`
              : '';
            ctx.telegram.sendMessage(
              referrerTelegramId,
              `🎊 *Your referral link worked!*\n\n` +
              `*${tg.first_name || tg.username}* just joined SafeDeal.\n` +
              `🪙 You earned *+50 SafeCoins*! Total: *${referrer.safe_crystals} coins*${milestoneMsg}`,
              { parse_mode: 'Markdown' }
            ).catch(() => {});
          }
        }
      } else {
        // Self-referral or invalid — just register normally
        user = await User.upsert({
          telegram_id: tg.id,
          username   : tg.username,
          first_name : tg.first_name,
          last_name  : tg.last_name,
        });
      }
    } else {
      // Normal registration / returning user
      user = await User.upsert({
        telegram_id: tg.id,
        username   : tg.username,
        first_name : tg.first_name,
        last_name  : tg.last_name,
      });
    }

    // Update streak and award XP for daily login
    await User.updateStreak(user.id);
    await User.addXp(user.id, 10);

    // Direct app link: t.me/safedeal_bot?start=app
    if (args === 'app') {
      return ctx.reply(
        `🚀 *SafeDeal App*\n\nTap below to open:`,
        {
          parse_mode  : 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text   : '📱 Open SafeDeal',
              web_app: { url: process.env.WEBAPP_URL },
            }]],
          },
        }
      );
    }

    // If this is a room invite (freelancer following invite_link)
    if (args && args.startsWith('room_')) {
      const inviteLink = args.replace('room_', '');
      return handleRoomInvite(ctx, user, inviteLink);
    }

    // Regular /start — show main menu
    const levelInfo = `LVL ${user.level} · ${user.xp} XP`;
    const greeting  = user.deals_completed > 0
      ? `Welcome back, *${tg.first_name}*!`
      : `Welcome to *SafeDeal*, *${tg.first_name}*!`;

    await ctx.reply(
      `${greeting}\n\n` +
      `🛡 Secure deals on the TON blockchain\n\n` +
      `📊 Your status: ${levelInfo}\n` +
      `🔥 Streak: ${user.streak_days} days\n` +
      `🏅 Rating: ${user.rating > 0 ? `⭐ ${user.rating}` : 'no reviews'}\n\n` +
      `Choose an action:`,
      {
        parse_mode  : 'Markdown',
        reply_markup: mainMenu(),
      }
    );
  } catch (err) {
    console.error('[Bot] handleStart error:', err.message);
    await ctx.reply('An error occurred. Please try again later.');
  }
}

/**
 * Freelancer followed invite_link — show the contract.
 */
async function handleRoomInvite(ctx, user, inviteLink) {
  const { Room, Contract } = require('../../database/models');
  const { acceptContractMenu } = require('../keyboards/inline');
  const { query } = require('../../database/db');

  try {
    const room = await Room.findByInviteLink(inviteLink);
    if (!room) {
      return ctx.reply('❌ The link is invalid or the deal is already closed.');
    }

    if (room.client_id === user.id) {
      return ctx.reply('❌ You cannot accept your own deal.');
    }

    if (room.status !== 'waiting') {
      return ctx.reply('❌ This deal has already started or been completed.');
    }

    // Fetch contract
    const contract = await Contract.findByRoomId(room.id);
    if (!contract) {
      return ctx.reply('❌ Contract not found.');
    }

    const deadline = new Date(contract.deadline).toLocaleDateString('en-US');
    const criteria = contract.criteria.map((c, i) => `${i + 1}. ${c.text}`).join('\n');

    const webAppUrl = `${process.env.WEBAPP_URL}?room=${inviteLink}`;

    await ctx.reply(
      `📋 *Deal Proposal*\n\n` +
      `*${contract.title}*\n\n` +
      `📝 ${contract.description}\n\n` +
      `💰 Amount: *${contract.amount_usd} USD* (${contract.currency})\n` +
      `📅 Deadline: *${deadline}*\n\n` +
      `✅ Acceptance criteria:\n${criteria}\n\n` +
      `Tap the button below to open the deal in the app:`,
      {
        parse_mode  : 'Markdown',
        reply_markup: {
          inline_keyboard: [[{
            text   : '📱 Open deal in Mini App',
            web_app: { url: webAppUrl },
          }]],
        },
      }
    );
  } catch (err) {
    console.error('[Bot] handleRoomInvite error:', err.message);
    await ctx.reply('An error occurred while loading the deal.');
  }
}

module.exports = { handleStart, handleRoomInvite };
