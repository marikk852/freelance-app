'use strict';
/**
 * Routes: /api/marketing — AI маркетолог SafeDeal
 * SECURITY: только арбитр/администратор платформы.
 */

const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');
const marketingAgent = require('../services/marketingAgent');

// Middleware: только арбитр/admin
function requireArbitrator(req, res, next) {
  const arbitratorTgId = process.env.ARBITRATOR_TELEGRAM_ID;
  if (!arbitratorTgId || Number(req.user.telegramId) !== Number(arbitratorTgId)) {
    return res.status(403).json({ error: 'Только администратор платформы' });
  }
  next();
}

router.use(requireArbitrator);

/**
 * POST /api/marketing/strategy
 * Генерирует маркетинговую стратегию для указанного канала.
 */
router.post('/strategy', async (req, res) => {
  try {
    const { goal, channel, audience } = req.body;
    if (!goal || !channel) {
      return res.status(400).json({ error: 'goal и channel обязательны' });
    }

    const validChannels = ['telegram', 'twitter', 'reddit', 'product_hunt', 'referral', 'content'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: `channel должен быть одним из: ${validChannels.join(', ')}` });
    }

    const strategy = await marketingAgent.generateStrategy({ goal, channel, audience });
    res.json({ strategy });
  } catch (err) {
    console.error('[Marketing] strategy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/marketing/content
 * Генерирует готовый контент для публикации.
 */
router.post('/content', async (req, res) => {
  try {
    const { type, context, language } = req.body;
    if (!type) return res.status(400).json({ error: 'type обязателен' });

    const validTypes = ['telegram_post', 'cold_dm', 'reddit_post', 'landing_tagline', 'ad_copy'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type должен быть одним из: ${validTypes.join(', ')}` });
    }

    const variants = await marketingAgent.generateContent({ type, context, language });
    res.json({ variants });
  } catch (err) {
    console.error('[Marketing] content error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/marketing/growth
 * Анализирует текущие метрики платформы и даёт рекомендации.
 */
router.get('/growth', async (req, res) => {
  try {
    // Собираем реальные метрики из БД
    const { rows: stats } = await query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM contracts) AS total_deals,
        (SELECT COUNT(*) FROM contracts WHERE status = 'completed') AS completed_deals,
        (SELECT COUNT(*) FROM disputes) AS total_disputes,
        (SELECT COALESCE(AVG(amount_usd), 0) FROM contracts) AS avg_deal_amount
    `);

    const s = stats[0];
    const totalDeals = Number(s.total_deals) || 0;
    const totalDisputes = Number(s.total_disputes) || 0;

    const metrics = {
      totalUsers    : Number(s.total_users),
      totalDeals,
      completedDeals: Number(s.completed_deals),
      disputeRate   : totalDeals > 0 ? ((totalDisputes / totalDeals) * 100).toFixed(1) : 0,
      avgDealAmount : Math.round(Number(s.avg_deal_amount)),
    };

    const analysis = await marketingAgent.analyzeGrowth(metrics);
    res.json(analysis);
  } catch (err) {
    console.error('[Marketing] growth error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
