const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');
const { authMiddleware } = require('../middleware/auth');
const crystalService = require('../services/crystalService');

router.use(authMiddleware);

async function _userId(telegramId) {
  const { rows } = await query(`SELECT id FROM users WHERE telegram_id = $1`, [telegramId]);
  return rows[0] ? rows[0].id : null;
}

// GET /api/crystals — баланс + последние операции
router.get('/', async (req, res) => {
  try {
    const userId = await _userId(req.user.telegramId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    res.json(await crystalService.getBalanceAndHistory(userId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/crystals/shop — активные товары магазина (soft-only)
router.get('/shop', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT key, label, cost, category FROM crystal_shop_items
       WHERE is_active = TRUE ORDER BY sort_order`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/crystals/spend/:key — потратить кристаллы на товар
router.post('/spend/:key', async (req, res) => {
  try {
    const userId = await _userId(req.user.telegramId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const result = await crystalService.spend(userId, req.params.key);
    res.json({ success: true, ...result });
  } catch (e) {
    const code = e.message === 'Insufficient crystals' ? 402
               : e.message === 'Item not available'    ? 404 : 500;
    res.status(code).json({ error: e.message });
  }
});

module.exports = router;
