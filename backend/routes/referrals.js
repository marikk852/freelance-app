const express = require('express');
const router  = express.Router();
const { query, transaction } = require('../../database/db');
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

// Referral reward tiers
const REFERRAL_TIERS = [
  { key: '3_users',        required: 3,  type: 'count',  crystals: 300   },
  { key: '20_active_users', required: 20, type: 'active', crystals: 10000 },
];

// GET /api/referrals/me — referral stats + link
router.get('/me', async (req, res) => {
  try {
    const { rows: users } = await query(
      `SELECT id, telegram_id, referral_count FROM users WHERE telegram_id = $1`,
      [req.user.telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    const user = users[0];

    // Count active referrals (5+ visits in last 30 days)
    const { rows: activeRows } = await query(
      `SELECT COUNT(DISTINCT u.id)::int AS count
       FROM users u
       JOIN user_visits uv ON uv.user_id = u.id
       WHERE u.referred_by = $1
         AND uv.visited_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY u.id
       HAVING COUNT(uv.id) >= 5`,
      [user.telegram_id]
    );
    const activeReferrals = activeRows.length;

    // Claimed tiers
    const { rows: claimed } = await query(
      `SELECT tier FROM referral_rewards WHERE referrer_id = $1`, [user.id]
    );
    const claimedTiers = claimed.map(r => r.tier);

    // Build referral link
    const botUsername = process.env.BOT_USERNAME || 'safedeal_bot';
    const referralLink = `https://t.me/${botUsername}?start=ref_${user.telegram_id}`;

    res.json({
      referral_link  : referralLink,
      total_referrals: user.referral_count,
      active_referrals: activeReferrals,
      tiers: REFERRAL_TIERS.map(t => ({
        ...t,
        claimed  : claimedTiers.includes(t.key),
        progress : t.type === 'active' ? activeReferrals : user.referral_count,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/claim/:tier — claim reward for a tier
router.post('/claim/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    const tierConfig = REFERRAL_TIERS.find(t => t.key === tier);
    if (!tierConfig) return res.status(404).json({ error: 'Invalid tier' });

    const { rows: users } = await query(
      `SELECT id, telegram_id, referral_count FROM users WHERE telegram_id = $1`,
      [req.user.telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    const user = users[0];

    // Check already claimed
    const { rows: already } = await query(
      `SELECT id FROM referral_rewards WHERE referrer_id = $1 AND tier = $2`,
      [user.id, tier]
    );
    if (already[0]) return res.status(409).json({ error: 'Already claimed' });

    // Check eligibility
    let eligible = false;
    if (tierConfig.type === 'count') {
      eligible = user.referral_count >= tierConfig.required;
    } else if (tierConfig.type === 'active') {
      const { rows: activeRows } = await query(
        `SELECT COUNT(DISTINCT u.id)::int AS count
         FROM users u
         JOIN user_visits uv ON uv.user_id = u.id
         WHERE u.referred_by = $1
           AND uv.visited_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY u.id
         HAVING COUNT(uv.id) >= 5`,
        [user.telegram_id]
      );
      eligible = activeRows.length >= tierConfig.required;
    }

    if (!eligible) {
      return res.status(403).json({ error: 'Requirements not met', required: tierConfig.required });
    }

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO referral_rewards (referrer_id, tier, crystals) VALUES ($1, $2, $3)`,
        [user.id, tier, tierConfig.crystals]
      );
      await client.query(
        `UPDATE users SET safe_crystals = safe_crystals + $1 WHERE id = $2`,
        [tierConfig.crystals, user.id]
      );
    });

    res.json({ success: true, crystals_awarded: tierConfig.crystals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
