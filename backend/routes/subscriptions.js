const express = require('express');
const router  = express.Router();
const { query, transaction } = require('../../database/db');
const { authMiddleware } = require("../middleware/auth");
const tonService     = require('../services/tonService');
const { fromNano, toNano } = require('@ton/ton');

router.use(authMiddleware);

// GET /api/subscriptions/plans — available plans
router.get('/plans', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY sort_order`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscriptions/my — current user subscription
router.get('/my', async (req, res) => {
  try {
    const { rows: users } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`, [req.user.telegramId]
    );
    if (!users[0]) return res.json({ subscription: null });

    const { rows } = await query(
      `SELECT us.*, sp.key AS plan_key, sp.name AS plan_name, sp.features
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1 AND us.status = 'active' AND us.expires_at > NOW()
       ORDER BY us.expires_at DESC LIMIT 1`,
      [users[0].id]
    );
    res.json({ subscription: rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscriptions/purchase — initiate subscription payment
// GET /api/subscriptions/quote/:plan_key — сколько TON стоит план по текущему курсу
// (превью для UI до открытия кошелька; ничего не создаёт)
router.get('/quote/:plan_key', async (req, res) => {
  try {
    const { plan_key } = req.params;
    if (!['basic', 'pro'].includes(plan_key)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    const { rows: plans } = await query(
      `SELECT * FROM subscription_plans WHERE key = $1 AND is_active = TRUE`, [plan_key]
    );
    if (!plans[0]) return res.status(404).json({ error: 'Plan not available' });

    const tonPrice = await tonService.getTonUsdPrice();
    res.json({
      plan_key,
      price_usd     : plans[0].price_usd,
      ton_amount    : (plans[0].price_usd / tonPrice).toFixed(4),
      ton_price_usd : tonPrice,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchase', async (req, res) => {
  try {
    const { plan_key, currency = 'USDT' } = req.body;
    if (!['basic', 'pro'].includes(plan_key)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const { rows: plans } = await query(
      `SELECT * FROM subscription_plans WHERE key = $1 AND is_active = TRUE`, [plan_key]
    );
    if (!plans[0]) return res.status(404).json({ error: 'Plan not available' });
    const plan = plans[0];

    const { rows: users } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`, [req.user.telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });

    // Calculate crypto amount
    let cryptoAmount;
    if (currency === 'TON') {
      const tonPrice = await tonService.getTonUsdPrice();
      cryptoAmount = (plan.price_usd / tonPrice).toFixed(9);
    } else {
      cryptoAmount = plan.price_usd.toString();
    }

    const arbitratorAddress = tonService.getArbitratorAddress();

    res.json({
      plan,
      payment: {
        to: arbitratorAddress,
        amount: cryptoAmount,
        currency,
        memo: `sub_${plan_key}_${users[0].id}`,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscriptions/confirm — confirm payment after tx
router.post('/confirm', async (req, res) => {
  try {
    const { plan_key, tx_hash, currency = 'TON' } = req.body;
    if (!tx_hash) return res.status(400).json({ error: 'tx_hash required' });

    const { rows: plans } = await query(
      `SELECT * FROM subscription_plans WHERE key = $1`, [plan_key]
    );
    if (!plans[0]) return res.status(404).json({ error: 'Plan not found' });
    const plan = plans[0];

    const { rows: users } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`, [req.user.telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    const userId = users[0].id;

    // Check duplicate tx
    const { rows: dup } = await query(
      `SELECT id FROM user_subscriptions WHERE tx_hash = $1`, [tx_hash]
    );
    if (dup[0]) return res.status(409).json({ error: 'Transaction already used' });

    // Verify payment on-chain
    if (currency === 'TON') {
      const tonPrice     = await tonService.getTonUsdPrice();
      const expectedTon  = plan.price_usd / tonPrice;
      const verification = await tonService.verifyTonPayment(tx_hash, expectedTon);
      if (!verification.valid) {
        return res.status(402).json({ error: 'Payment not found on blockchain. Try again in a few seconds.' });
      }
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await transaction(async (client) => {
      // Expire previous subscriptions
      await client.query(
        `UPDATE user_subscriptions SET status = 'expired'
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      // Create new subscription
      await client.query(
        `INSERT INTO user_subscriptions
           (user_id, plan_id, expires_at, tx_hash, currency, amount_paid)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, plan.id, expiresAt, tx_hash, currency, plan.price_usd]
      );

      // Award crystals
      await client.query(
        `UPDATE users SET
           safe_crystals = safe_crystals + $1,
           subscription_plan = $2,
           subscription_expires = $3
         WHERE id = $4`,
        [plan.crystals_reward, plan.key, expiresAt, userId]
      );
    });

    res.json({ success: true, expires_at: expiresAt, crystals_awarded: plan.crystals_reward });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
