const express  = require('express');
const router   = express.Router();
const { query } = require('../../database/db');
const { authMiddleware } = require('../middleware/auth');

// ============================================================
// Routes: /api/quests
// ============================================================

/**
 * GET /api/quests
 * Returns all active quests with completion status for current user.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await query(
      `SELECT q.*,
              (uq.id IS NOT NULL) AS completed,
              uq.completed_at
       FROM quests q
       LEFT JOIN user_quests uq ON uq.quest_id = q.id AND uq.user_id = $1
       WHERE q.is_active = TRUE
       ORDER BY q.sort_order ASC`,
      [userId]
    );

    // Auto-check and complete eligible quests
    const completed = await autoCheckQuests(userId, req.user);

    // Re-fetch if any were auto-completed
    if (completed.length > 0) {
      const { rows: fresh } = await query(
        `SELECT q.*,
                (uq.id IS NOT NULL) AS completed,
                uq.completed_at
         FROM quests q
         LEFT JOIN user_quests uq ON uq.quest_id = q.id AND uq.user_id = $1
         WHERE q.is_active = TRUE
         ORDER BY q.sort_order ASC`,
        [userId]
      );
      return res.json({ quests: fresh, newlyCompleted: completed });
    }

    res.json({ quests: rows, newlyCompleted: [] });
  } catch (err) {
    console.error('[Quests] GET /quests error:', err.message);
    res.status(500).json({ error: 'Failed to load quests' });
  }
});

/**
 * POST /api/quests/:key/claim
 * Manually claim a quest reward (for quests that need user action).
 */
router.post('/:key/claim', authMiddleware, async (req, res) => {
  try {
    const userId   = req.user.id;
    const { key }  = req.params;

    // Get quest
    const { rows: qRows } = await query(
      `SELECT * FROM quests WHERE key = $1 AND is_active = TRUE`,
      [key]
    );
    if (!qRows[0]) return res.status(404).json({ error: 'Quest not found' });
    const quest = qRows[0];

    // Check not already completed (unless repeatable)
    const { rows: existing } = await query(
      `SELECT id FROM user_quests WHERE user_id = $1 AND quest_id = $2`,
      [userId, quest.id]
    );
    if (existing.length > 0 && !quest.is_repeatable) {
      return res.status(400).json({ error: 'Quest already completed' });
    }

    // Verify eligibility
    const eligible = await checkQuestEligibility(key, userId, req.user);
    if (!eligible) {
      return res.status(400).json({ error: 'Quest requirements not met' });
    }

    // Award coins + record completion
    await query(
      `INSERT INTO user_quests (user_id, quest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, quest.id]
    );
    await query(
      `UPDATE users SET safe_coins = safe_coins + $1, updated_at = NOW() WHERE id = $2`,
      [quest.coins, userId]
    );

    const { rows: updated } = await query(
      `SELECT safe_coins FROM users WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, coins: quest.coins, totalCoins: updated[0].safe_coins });
  } catch (err) {
    console.error('[Quests] claim error:', err.message);
    res.status(500).json({ error: 'Failed to claim quest' });
  }
});

// ============================================================
// Helpers
// ============================================================

/**
 * Auto-check and complete quests the user already qualifies for.
 */
async function autoCheckQuests(userId, user) {
  const completed = [];
  const autoKeys  = [
    'link_wallet', 'complete_profile', 'first_deal', 'first_completed',
    'five_deals', 'first_review', 'streak_7', 'streak_30',
    'first_referral', 'five_referrals',
  ];

  for (const key of autoKeys) {
    const { rows: already } = await query(
      `SELECT uq.id FROM user_quests uq
       JOIN quests q ON q.id = uq.quest_id
       WHERE uq.user_id = $1 AND q.key = $2`,
      [userId, key]
    );
    if (already.length > 0) continue;

    const eligible = await checkQuestEligibility(key, userId, user);
    if (!eligible) continue;

    const { rows: qRows } = await query(`SELECT * FROM quests WHERE key = $1`, [key]);
    if (!qRows[0]) continue;
    const quest = qRows[0];

    await query(
      `INSERT INTO user_quests (user_id, quest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, quest.id]
    );
    await query(
      `UPDATE users SET safe_coins = safe_coins + $1, updated_at = NOW() WHERE id = $2`,
      [quest.coins, userId]
    );
    completed.push({ key, title: quest.title, coins: quest.coins });
  }

  return completed;
}

/**
 * Check if user meets requirements for a specific quest.
 */
async function checkQuestEligibility(key, userId, user) {
  switch (key) {
    case 'link_wallet': {
      const { rows } = await query(`SELECT ton_wallet_address FROM users WHERE id = $1`, [userId]);
      return !!rows[0]?.ton_wallet_address;
    }
    case 'complete_profile': {
      const { rows } = await query(`SELECT profile_completed FROM users WHERE id = $1`, [userId]);
      return rows[0]?.profile_completed === true;
    }
    case 'first_deal': {
      const { rows } = await query(
        `SELECT id FROM rooms WHERE client_id = $1 LIMIT 1`, [userId]
      );
      return rows.length > 0;
    }
    case 'first_completed': {
      const { rows } = await query(
        `SELECT id FROM users WHERE id = $1 AND deals_completed >= 1`, [userId]
      );
      return rows.length > 0;
    }
    case 'five_deals': {
      const { rows } = await query(
        `SELECT id FROM users WHERE id = $1 AND deals_completed >= 5`, [userId]
      );
      return rows.length > 0;
    }
    case 'first_review': {
      const { rows } = await query(
        `SELECT id FROM reviews WHERE reviewee_id = $1 LIMIT 1`, [userId]
      );
      return rows.length > 0;
    }
    case 'streak_7': {
      const { rows } = await query(
        `SELECT id FROM users WHERE id = $1 AND streak_days >= 7`, [userId]
      );
      return rows.length > 0;
    }
    case 'streak_30': {
      const { rows } = await query(
        `SELECT id FROM users WHERE id = $1 AND streak_days >= 30`, [userId]
      );
      return rows.length > 0;
    }
    case 'first_referral': {
      const { rows } = await query(
        `SELECT id FROM users WHERE id = $1 AND referral_count >= 1`, [userId]
      );
      return rows.length > 0;
    }
    case 'five_referrals': {
      const { rows } = await query(
        `SELECT id FROM users WHERE id = $1 AND referral_count >= 5`, [userId]
      );
      return rows.length > 0;
    }
    case 'post_job': {
      const { rows } = await query(
        `SELECT id FROM job_posts WHERE client_id = $1 LIMIT 1`, [userId]
      );
      return rows.length > 0;
    }
    case 'first_portfolio': {
      const { rows } = await query(
        `SELECT id FROM portfolio_items WHERE freelancer_id = $1 LIMIT 1`, [userId]
      );
      return rows.length > 0;
    }
    default:
      return false;
  }
}

module.exports = router;
