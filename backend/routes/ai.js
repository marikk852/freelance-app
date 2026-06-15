const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth');
const tierService = require('../services/tierService');
const dealAssistant = require('../services/dealAssistant');

router.use(authMiddleware);

/**
 * POST /api/ai/draft-deal — AI помощник по заказу (PRO).
 * Body: { messages: [{role:'user'|'assistant', content:string}] }
 * Returns: { reply, ready, draft }
 */
router.post('/draft-deal', async (req, res) => {
  try {
    // Только PRO
    const tier = await tierService.getTierLimitsByTelegramId(req.user.telegramId);
    if (tier.key !== 'pro') {
      return res.status(403).json({ error: 'AI deal assistant is a PRO feature' });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    // Санитизация: только role+content, последние 20, обрезка длины
    const safe = messages.slice(-20).map(m => ({
      role   : m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    })).filter(m => m.content.length > 0);
    if (safe.length === 0) return res.status(400).json({ error: 'empty messages' });

    const result = await dealAssistant.draftDeal(safe);
    if (!result) return res.status(502).json({ error: 'AI did not return a valid response' });
    res.json(result);
  } catch (err) {
    console.error('[AI] draft-deal error:', err.message);
    const code = err.message && err.message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    res.status(code).json({ error: code === 503 ? 'AI assistant not configured' : 'AI assistant unavailable' });
  }
});

module.exports = router;
